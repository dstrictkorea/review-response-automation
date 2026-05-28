'use client'

interface DateInputProps {
  name: string
  defaultValue?: string
  placeholder?: string
}

export default function DateInput({ name, defaultValue = '', placeholder }: DateInputProps) {
  return (
    <input
      type="date"
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onFocus={(e) => {
        try {
          ;(e.target as HTMLInputElement).showPicker?.()
        } catch {}
      }}
      onClick={(e) => {
        try {
          ;(e.target as HTMLInputElement).showPicker?.()
        } catch {}
      }}
      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none cursor-pointer"
    />
  )
}
