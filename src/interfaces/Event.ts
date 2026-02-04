export interface AppEvent {
  id: string // Holiday: "holiday-{date}-{slug}" | Custom: nanoid()
  title: string // Event name
  date: string // Start date: YYYY-MM-DD
  endDate?: string // End date: YYYY-MM-DD. Undefined = single day
  startTime?: string // Start time: HH:mm. Undefined = all-day event
  endTime?: string // End time: HH:mm. Undefined = all-day event
  type: 'holiday' | 'custom'
  description?: string
}
