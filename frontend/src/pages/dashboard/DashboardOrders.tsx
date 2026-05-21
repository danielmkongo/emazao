import { ShoppingBag } from 'lucide-react'
export default function DashboardOrders() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Orders</h1>
      <div className="text-center py-20"><ShoppingBag className="h-12 w-12 text-white/20 mx-auto mb-4" /><p className="text-white/40">No orders yet</p></div>
    </div>
  )
}
