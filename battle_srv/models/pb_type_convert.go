package models

import (
	. "battle_srv/protos"
)

func toPbPlayers(modelInstances map[int32]*Player, withMetaInfo bool) map[int32]*PlayerDownsync {
	toRet := make(map[int32]*PlayerDownsync, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &PlayerDownsync{
			Id:             last.Id,
			VirtualGridX:   last.VirtualGridX,
			VirtualGridY:   last.VirtualGridY,
			DirX:           last.DirX,
			DirY:           last.DirY,
			ColliderRadius: last.ColliderRadius,
			Speed:          last.Speed,
			BattleState:    last.BattleState,
			Score:          last.Score,
			Removed:        last.Removed,
			JoinIndex:      last.JoinIndex,
		}
		if withMetaInfo {
			toRet[k].Name = last.Name
			toRet[k].DisplayName = last.DisplayName
			toRet[k].Avatar = last.Avatar
		}
	}

	return toRet
}
