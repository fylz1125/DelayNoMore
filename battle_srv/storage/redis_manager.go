package storage

import (
	. "battle_srv/common"
	"fmt"

	"github.com/go-redis/redis"
	_ "github.com/go-sql-driver/mysql"
	"go.uber.org/zap"

	. "dnmshared"
)

var (
	RedisManagerIns *redis.Client
)

func initRedis() {
	RedisManagerIns = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", Conf.Redis.Host, Conf.Redis.Port),
		Password: Conf.Redis.Password, // no password set
		DB:       Conf.Redis.Dbname,   // use default DB
	})
	pong, err := RedisManagerIns.Ping().Result()
	if nil != err {
		panic(err)
	}
	Logger.Info("Redis", zap.String("ping", pong))
}
