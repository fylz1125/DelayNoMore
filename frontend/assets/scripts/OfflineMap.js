const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

const OnlineMap = require('./Map');

cc.Class({
  extends: OnlineMap,

  onDestroy() {
    console.warn("+++++++ Map onDestroy()");
  },

  onLoad() {
    const self = this;
    window.mapIns = self;

    cc.director.getCollisionManager().enabled = false;

    const mapNode = self.node;
    const canvasNode = mapNode.parent;

    self.mainCameraNode = self.canvasNode.getChildByName("Main Camera");
    self.mainCamera = self.mainCameraNode.getComponent(cc.Camera);
    for (let child of self.mainCameraNode.children) {
      child.setScale(1 / self.mainCamera.zoomRatio);
    }
    self.widgetsAboveAllNode = self.mainCameraNode.getChildByName("WidgetsAboveAll");
    self.mainCameraNode.setPosition(cc.v2());

    /** Init required prefab ended. */

    self.inputDelayFrames = 8;
    self.inputScaleFrames = 2;
    self.inputFrameUpsyncDelayTolerance = 2;

    self.rollbackEstimatedDt = 0.016667;
    self.rollbackEstimatedDtMillis = 16.667;
    self.rollbackEstimatedDtNanos = 16666666;

    self.worldToVirtualGridRatio = 1000;
    self.virtualGridToWorldRatio = 1.0 / self.worldToVirtualGridRatio;
    self.meleeSkillConfig = {
      1: {
        // for offender
        startupFrames: 23,
        activeFrames: 3,
        recoveryFrames: 61, // usually but not always "startupFrames+activeFrames", I hereby set it to be 1 frame more than the actual animation to avoid critical transition, i.e. when the animation is 1 frame from ending but "rdfPlayer.framesToRecover" is already counted 0 and the player triggers an other same attack, making an effective bullet trigger but no animation is played due to same animName is still playing
        recoveryFramesOnBlock: 61,
        recoveryFramesOnHit: 61,
        moveforward: {
          x: 0,
          y: 0,
        },
        hitboxOffset: 12.0, // should be about the radius of the PlayerCollider 
        hitboxSize: {
          x: 45.0,
          y: 32.0,
        },

        // for defender
        hitStunFrames: 18,
        blockStunFrames: 9,
        pushback: 11.0,
        releaseTriggerType: 1, // 1: rising-edge, 2: falling-edge  
        damage: 5
      }
    };

    const tiledMapIns = self.node.getComponent(cc.TiledMap);

    const fullPathOfTmxFile = cc.js.formatStr("map/%s/map", "dungeon");
    cc.loader.loadRes(fullPathOfTmxFile, cc.TiledMapAsset, (err, tmxAsset) => {
      if (null != err) {
        console.error(err);
        return;
      }

      tiledMapIns.tmxAsset = null;
      mapNode.removeAllChildren();
      self._resetCurrentMatch();

      tiledMapIns.tmxAsset = tmxAsset;
      const newMapSize = tiledMapIns.getMapSize();
      const newTileSize = tiledMapIns.getTileSize();
      self.node.setContentSize(newMapSize.width * newTileSize.width, newMapSize.height * newTileSize.height);
      self.node.setPosition(cc.v2(0, 0));

      let barrierIdCounter = 0;
      const boundaryObjs = tileCollisionManager.extractBoundaryObjects(self.node);
      for (let boundaryObj of boundaryObjs.barriers) {
        const x0 = boundaryObj.anchor.x,
          y0 = boundaryObj.anchor.y;

        const newBarrier = self.collisionSys.createPolygon(x0, y0, Array.from(boundaryObj, p => {
          return [p.x, p.y];
        }));

        if (self.showCriticalCoordinateLabels) {
          for (let i = 0; i < boundaryObj.length; ++i) {
            const barrierVertLabelNode = new cc.Node();
            switch (i % 4) {
              case 0:
                barrierVertLabelNode.color = cc.Color.RED;
                break;
              case 1:
                barrierVertLabelNode.color = cc.Color.GRAY;
                break;
              case 2:
                barrierVertLabelNode.color = cc.Color.BLACK;
                break;
              default:
                barrierVertLabelNode.color = cc.Color.MAGENTA;
                break;
            }
            const wx = boundaryObj.anchor.x + boundaryObj[i].x,
              wy = boundaryObj.anchor.y + boundaryObj[i].y;
            barrierVertLabelNode.setPosition(cc.v2(wx, wy));
            const barrierVertLabel = barrierVertLabelNode.addComponent(cc.Label);
            barrierVertLabel.fontSize = 12;
            barrierVertLabel.lineHeight = barrierVertLabel.fontSize + 1;
            barrierVertLabel.string = `(${wx.toFixed(1)}, ${wy.toFixed(1)})`;
            safelyAddChild(self.node, barrierVertLabelNode);
            setLocalZOrder(barrierVertLabelNode, 5);

            barrierVertLabelNode.active = true;
          }

        }
        // console.log("Created barrier: ", newBarrier);
        ++barrierIdCounter;
        const collisionBarrierIndex = (self.collisionBarrierIndexPrefix + barrierIdCounter);
        self.collisionSysMap.set(collisionBarrierIndex, newBarrier);
      }

      const startRdf = window.pb.protos.RoomDownsyncFrame.create({
        id: window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START,
        players: {
          10: {
            id: 10,
            joinIndex: 1,
            virtualGridX: 0,
            virtualGridY: 0,
            speed: 1 * self.worldToVirtualGridRatio,
            colliderRadius: 12,
            characterState: window.ATK_CHARACTER_STATE.Idle1[0],
            framesToRecover: 0,
            dirX: 0,
            dirY: 0,
          },
          11: {
            id: 11,
            joinIndex: 2,
            virtualGridX: 80 * self.worldToVirtualGridRatio,
            virtualGridY: 40 * self.worldToVirtualGridRatio,
            speed: 1 * self.worldToVirtualGridRatio,
            colliderRadius: 12,
            characterState: window.ATK_CHARACTER_STATE.Idle1[0],
            framesToRecover: 0,
            dirX: 0,
            dirY: 0,
          },
        }
      });
      self.selfPlayerInfo = {
        id: 10
      };
      self._initPlayerRichInfoDict(startRdf.players);
      self.onRoomDownsyncFrame(startRdf);

      self.battleState = ALL_BATTLE_STATES.IN_BATTLE;
    });

  },

  update(dt) {
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE == self.battleState) {
      const elapsedMillisSinceLastFrameIdTriggered = performance.now() - self.lastRenderFrameIdTriggeredAt;
      if (elapsedMillisSinceLastFrameIdTriggered < (self.rollbackEstimatedDtMillis)) {
        // console.debug("Avoiding too fast frame@renderFrameId=", self.renderFrameId, ": elapsedMillisSinceLastFrameIdTriggered=", elapsedMillisSinceLastFrameIdTriggered);
        return;
      }
      try {
        let st = performance.now();
        let prevSelfInput = null,
          currSelfInput = null;
        const noDelayInputFrameId = self._convertToInputFrameId(self.renderFrameId, 0); // It's important that "inputDelayFrames == 0" here 
        if (self.shouldGenerateInputFrameUpsync(self.renderFrameId)) {
          const prevAndCurrInputs = self._generateInputFrameUpsync(noDelayInputFrameId);
          prevSelfInput = prevAndCurrInputs[0];
          currSelfInput = prevAndCurrInputs[1];
        }

        const [prevRdf, rdf] = self.rollbackAndChase(self.renderFrameId, self.renderFrameId + 1, self.collisionSys, self.collisionSysMap, false);
        self.applyRoomDownsyncFrameDynamics(rdf, prevRdf);
        let t3 = performance.now();
      } catch (err) {
        console.error("Error during Map.update", err);
      } finally {
        ++self.renderFrameId; // [WARNING] It's important to increment the renderFrameId AFTER all the operations above!!!
      }
    }
  },
});
