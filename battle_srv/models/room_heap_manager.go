package models

import (
	"container/heap"
	. "dnmshared"
	"fmt"
	"go.uber.org/zap"
	"sync"
)

// Reference https://github.com/genxium/GoStructPrac.
type RoomHeap []*Room
type RoomMap map[int32]*Room

var (
	// NOTE: For the package exported instances of non-primitive types to be accessed as singletons, they must be of pointer types.
	RoomHeapMux        *sync.Mutex
	RoomHeapManagerIns *RoomHeap
	RoomMapManagerIns  *RoomMap
)

func (pPq *RoomHeap) PrintInOrder() {
	pq := *pPq
	fmt.Printf("The RoomHeap instance now contains:\n")
	for i := 0; i < len(pq); i++ {
		fmt.Printf("{index: %d, roomID: %d, score: %.2f} ", i, pq[i].Id, pq[i].Score)
	}
	fmt.Printf("\n")
}

func (pq RoomHeap) Len() int { return len(pq) }

func (pq RoomHeap) Less(i, j int) bool {
	return pq[i].Score > pq[j].Score
}

func (pq *RoomHeap) Swap(i, j int) {
	(*pq)[i], (*pq)[j] = (*pq)[j], (*pq)[i]
	(*pq)[i].Index = i
	(*pq)[j].Index = j
}

func (pq *RoomHeap) Push(pItem interface{}) {
	// NOTE: Must take input param type `*Room` here.
	n := len(*pq)
	pItem.(*Room).Index = n
	*pq = append(*pq, pItem.(*Room))
}

func (pq *RoomHeap) Pop() interface{} {
	old := *pq
	n := len(old)
	if n == 0 {
		return nil
	}
	pItem := old[n-1]
	if pItem.Score <= float32(0.0) {
		return nil
	}
	pItem.Index = -1 // for safety
	*pq = old[0 : n-1]
	// NOTE: Must return instance which is directly castable to type `*Room` here.
	return pItem
}

func (pq *RoomHeap) update(pItem *Room, Score float32) {
	// NOTE: Must use type `*Room` here.
	heap.Fix(pq, pItem.Index)
}

func (pq *RoomHeap) Update(pItem *Room, Score float32) {
	pq.update(pItem, Score)
}

func PrintRoomMap() {
	fmt.Printf("The RoomMap instance now contains:\n")
	for _, pR := range *RoomMapManagerIns {
		fmt.Printf("{roomID: %d, score: %.2f} ", pR.Id, pR.Score)
	}
	fmt.Printf("\n")
}

func InitRoomHeapManager() {
	RoomHeapMux = new(sync.Mutex)
	// Init "pseudo class constants".
	InitRoomBattleStateIns()
	InitPlayerBattleStateIns()
	initialCountOfRooms := 32
	pq := make(RoomHeap, initialCountOfRooms)
	roomMap := make(RoomMap, initialCountOfRooms)

	for i := 0; i < initialCountOfRooms; i++ {
		roomCapacity := 2
		pq[i] = &Room{
			Id:       int32(i + 1),
			Capacity: roomCapacity,
			Index:    i,
		}
		roomMap[pq[i].Id] = pq[i]
		pq[i].OnDismissed()
	}
	heap.Init(&pq)
	RoomHeapManagerIns = &pq
	RoomMapManagerIns = &roomMap
	Logger.Info("The RoomHeapManagerIns has been initialized:", zap.Any("addr", fmt.Sprintf("%p", RoomHeapManagerIns)), zap.Any("size", len(*RoomHeapManagerIns)))
	Logger.Info("The RoomMapManagerIns has been initialized:", zap.Any("size", len(*RoomMapManagerIns)))
}
