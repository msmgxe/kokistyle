export type BookingStatus = "pending" | "confirmed" | "done" | "cancelled";

export interface Booking {
  id: string;
  service: string;
  service_icon: string | null;
  duration_min: number;
  booking_date: string;
  booking_time: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
}
