import { useEffect, useState } from 'react'
import { readTurnOrder, subscribeTurnOrder } from '../services/turnOrder'

export function useTurnOrder() {
  const [order, setOrder] = useState(readTurnOrder)
  useEffect(() => subscribeTurnOrder(() => setOrder(readTurnOrder())), [])
  return order
}
