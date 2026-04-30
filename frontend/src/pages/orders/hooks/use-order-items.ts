import { useMemo, useState } from 'react'

export type ItemForm = {
  variant_sku: string
  product_id: number | null
  product_name: string
  sku: string
  image_url: string | null
  stock_on_hand: number
  stock_available: number
  quantity: string
  unit_price: string
  discount_amount: string
  notes: string
  noteOpen: boolean
}

export type ItemRow = ItemForm & {
  subTotal: number
}

type UseOrderItemsOptions<TProduct> = {
  createItemFromProduct: (product: TProduct) => ItemForm
  parseCurrencyValue: (value: string | number | null | undefined) => number
}

export function useOrderItems<TProduct>({
  createItemFromProduct,
  parseCurrencyValue,
}: UseOrderItemsOptions<TProduct>) {
  const [items, setItems] = useState<ItemForm[]>([])
  const [productSearchInput, setProductSearchInput] = useState('')
  const [productSearchResetKey, setProductSearchResetKey] = useState(0)
  const [selectedItemIndexes, setSelectedItemIndexes] = useState<number[]>([])

  const itemRows = useMemo<ItemRow[]>(
    () =>
      items.map((item) => {
        const quantity = Number(item.quantity || 0)
        const unitPrice = parseCurrencyValue(item.unit_price)
        const discountAmount = Number(item.discount_amount || 0)
        const subTotal = Math.max(quantity * unitPrice - discountAmount, 0)

        return {
          ...item,
          subTotal,
        }
      }),
    [items, parseCurrencyValue],
  )

  const selectedItemIndexSet = useMemo(() => new Set(selectedItemIndexes), [selectedItemIndexes])
  const selectedItemCount = selectedItemIndexes.length
  const areAllItemsSelected = itemRows.length > 0 && selectedItemCount === itemRows.length
  const areSomeItemsSelected = selectedItemCount > 0 && selectedItemCount < itemRows.length

  const replaceItems = (nextItems: ItemForm[]) => {
    setItems(nextItems)
    setSelectedItemIndexes([])
    setProductSearchInput('')
    setProductSearchResetKey((current) => current + 1)
  }

  const handleProductSearchChange = (value: string, reason: string) => {
    setProductSearchInput(reason === 'reset' ? '' : value)
  }

  const handleProductSearchSelect = (value: TProduct | null) => {
    if (!value) {
      setProductSearchInput('')
      return
    }

    setItems((current) => [...current, createItemFromProduct(value)])
    setSelectedItemIndexes([])
    setProductSearchInput('')
    setProductSearchResetKey((current) => current + 1)
  }

  const updateItem = (index: number, patch: Partial<ItemForm>) => {
    setItems((current) => current.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)))
  }

  const handleToggleItemSelection = (index: number) => {
    setSelectedItemIndexes((current) =>
      current.includes(index) ? current.filter((itemIndex) => itemIndex !== index) : [...current, index].sort((a, b) => a - b),
    )
  }

  const handleToggleAllItems = (checked: boolean) => {
    setSelectedItemIndexes(checked ? itemRows.map((_, index) => index) : [])
  }

  const handleBulkDeleteItems = () => {
    if (selectedItemIndexes.length === 0) {
      return
    }

    const selectedIndexes = new Set(selectedItemIndexes)
    setItems((current) => current.filter((_, index) => !selectedIndexes.has(index)))
    setSelectedItemIndexes([])
  }

  return {
    items,
    itemRows,
    productSearchInput,
    productSearchResetKey,
    selectedItemIndexSet,
    selectedItemCount,
    areAllItemsSelected,
    areSomeItemsSelected,
    replaceItems,
    handleProductSearchChange,
    handleProductSearchSelect,
    updateItem,
    handleToggleItemSelection,
    handleToggleAllItems,
    handleBulkDeleteItems,
  }
}
