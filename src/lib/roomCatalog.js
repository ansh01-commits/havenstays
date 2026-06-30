const ROOM_CATALOG = [
  { room_no: '001', floor: 0, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '002', floor: 0, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '003', floor: 0, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '004', floor: 0, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '101', floor: 1, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '102', floor: 1, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '103', floor: 1, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '104', floor: 1, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '105', floor: 1, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '106', floor: 1, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '201', floor: 2, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '202', floor: 2, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '203', floor: 2, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '204', floor: 2, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '205', floor: 2, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '206', floor: 2, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '301', floor: 3, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '302', floor: 3, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '303', floor: 3, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '304', floor: 3, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
  { room_no: '305', floor: 3, type: 'double', base_tariff: 1200, status: 'available', is_active: true },
]

function normalizeRoom(room, fallbackId) {
  const roomNo = room?.room_no ?? room?.roomNumber
  return {
    ...room,
    id: room?.id ?? (roomNo ? 1000 + Number(roomNo) : fallbackId),
    room_no: String(roomNo ?? ''),
    floor: Number(room?.floor ?? 0),
    type: room?.type ?? 'standard',
    base_tariff: Number(room?.base_tariff ?? 1200),
    status: room?.status ?? 'available',
    is_active: room?.is_active ?? true,
    manual_status: room?.manual_status ?? null,
  }
}

export function mergeRoomsWithCatalog(serverRooms = []) {
  const byRoomNo = new Map((serverRooms || []).filter(Boolean).map((room) => [String(room.room_no), room]))

  return ROOM_CATALOG.map((catalogRoom, index) => {
    const existingRoom = byRoomNo.get(String(catalogRoom.room_no))
    if (!existingRoom) {
      return normalizeRoom(catalogRoom, 1000 + index + 1)
    }

    return normalizeRoom({ ...catalogRoom, ...existingRoom }, existingRoom.id ?? 1000 + index + 1)
  })
}

export const FULL_ROOM_LIST = ROOM_CATALOG.map((room, index) => normalizeRoom(room, 1000 + index + 1))
