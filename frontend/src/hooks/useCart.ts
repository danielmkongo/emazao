import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

export interface CartLine {
  productId: string
  slug?: string
  title: string
  image: string
  unitPrice: number
  unit: string
  quantity: number
  minimumOrder: number
  availableStock?: number
  lineTotal: number
  belowMinimum: boolean
}

export interface CartGroup {
  seller: Pick<User, '_id' | 'name' | 'username' | 'avatar' | 'isVerified'>
  items: CartLine[]
  subtotal: number
  platformFee: number
  total: number
}

export interface CartView {
  groups: CartGroup[]
  unavailable: { productId: string; title: string; reason: string }[]
  itemCount: number
  subtotal: number
  platformFee: number
  total: number
  currency: string
}

const EMPTY: CartView = { groups: [], unavailable: [], itemCount: 0, subtotal: 0, platformFee: 0, total: 0, currency: 'TZS' }

/**
 * The cart, shared by the header badge, product pages and the cart page. Every
 * mutation returns the recomputed cart, which is written straight into the
 * cache — so the badge and totals update from the server's own pricing rather
 * than from an optimistic guess that could disagree with checkout.
 */
export function useCart() {
  const { isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CartView>>('/cart')
      return res.data.data ?? EMPTY
    },
    enabled: isAuthenticated,
    staleTime: 15_000,
  })

  const settle = (data?: CartView) => { if (data) queryClient.setQueryData(['cart'], data) }

  const add = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity?: number }) =>
      (await api.post<ApiResponse<CartView>>('/cart/items', { productId, quantity })).data.data,
    onSuccess: settle,
  })

  const update = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) =>
      (await api.put<ApiResponse<CartView>>(`/cart/items/${productId}`, { quantity })).data.data,
    onSuccess: settle,
  })

  const remove = useMutation({
    mutationFn: async (productId: string) =>
      (await api.delete<ApiResponse<CartView>>(`/cart/items/${productId}`)).data.data,
    onSuccess: settle,
  })

  const clear = useMutation({
    mutationFn: async () => (await api.delete<ApiResponse<CartView>>('/cart')).data.data,
    onSuccess: settle,
  })

  return { cart: query.data ?? EMPTY, isLoading: query.isLoading, add, update, remove, clear }
}
