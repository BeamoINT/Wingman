/**
 * Bookings API Service
 * Handles booking-related operations with Supabase
 */

import { supabase } from '../supabase';
import type { CompanionData } from './companions';

export interface BookingData {
  id: string;
  client_id: string;
  companion_id: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  date: string;
  start_time: string;
  end_time?: string;
  duration_hours: number;
  hourly_rate: number;
  subtotal: number;
  service_fee: number;
  total_price: number;
  location_name?: string;
  location_address?: string;
  activity_type?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  companion?: CompanionData;
}

export interface CreateBookingInput {
  companion_id: string;
  date: string;
  start_time: string;
  duration_hours: number;
  hourly_rate: number;
  location_name?: string;
  location_address?: string;
  activity_type?: string;
  notes?: string;
}

/**
 * Create a new booking
 */
export async function createBooking(input: CreateBookingInput): Promise<{ booking: BookingData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { booking: null, error: new Error('Not authenticated') };
    }

    const subtotal = input.hourly_rate * input.duration_hours;
    const serviceFee = Math.round(subtotal * 0.1 * 100) / 100; // 10% service fee
    const totalPrice = subtotal + serviceFee;

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        client_id: user.id,
        companion_id: input.companion_id,
        date: input.date,
        start_time: input.start_time,
        duration_hours: input.duration_hours,
        hourly_rate: input.hourly_rate,
        subtotal,
        service_fee: serviceFee,
        total_price: totalPrice,
        location_name: input.location_name,
        location_address: input.location_address,
        activity_type: input.activity_type,
        notes: input.notes,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      return { booking: null, error };
    }

    return { booking: data, error: null };
  } catch (err) {
    console.error('Error in createBooking:', err);
    return { booking: null, error: err as Error };
  }
}

/**
 * Fetch bookings for the current user (as client)
 */
export async function fetchUserBookings(): Promise<{ bookings: BookingData[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { bookings: [], error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        companion:companions(
          *,
          user:profiles!companions_user_id_fkey(*)
        )
      `)
      .eq('client_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching user bookings:', error);
      return { bookings: [], error };
    }

    return { bookings: data || [], error: null };
  } catch (err) {
    console.error('Error in fetchUserBookings:', err);
    return { bookings: [], error: err as Error };
  }
}

/**
 * Fetch bookings for the current user (as companion)
 */
export async function fetchCompanionBookings(): Promise<{ bookings: BookingData[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { bookings: [], error: new Error('Not authenticated') };
    }

    // First get the companion ID for this user
    const { data: companion, error: companionError } = await supabase
      .from('companions')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (companionError || !companion) {
      return { bookings: [], error: companionError || new Error('Not a companion') };
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        client:profiles!bookings_client_id_fkey(*)
      `)
      .eq('companion_id', companion.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching companion bookings:', error);
      return { bookings: [], error };
    }

    return { bookings: data || [], error: null };
  } catch (err) {
    console.error('Error in fetchCompanionBookings:', err);
    return { bookings: [], error: err as Error };
  }
}

/**
 * Get a single booking by ID
 */
export async function fetchBookingById(bookingId: string): Promise<{ booking: BookingData | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        companion:companions(
          *,
          user:profiles!companions_user_id_fkey(*)
        ),
        client:profiles!bookings_client_id_fkey(*)
      `)
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error fetching booking:', error);
      return { booking: null, error };
    }

    return { booking: data, error: null };
  } catch (err) {
    console.error('Error in fetchBookingById:', err);
    return { booking: null, error: err as Error };
  }
}

/**
 * Update booking status
 */
export async function updateBookingStatus(bookingId: string, status: BookingData['status']): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating booking status:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in updateBookingStatus:', err);
    return { success: false, error: err as Error };
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(bookingId: string, reason?: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error cancelling booking:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in cancelBooking:', err);
    return { success: false, error: err as Error };
  }
}

/**
 * Calculate companion earnings
 */
export async function fetchCompanionEarnings(): Promise<{ earnings: { week: number; month: number; year: number; total: number }; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { earnings: { week: 0, month: 0, year: 0, total: 0 }, error: new Error('Not authenticated') };
    }

    // Get companion ID
    const { data: companion, error: companionError } = await supabase
      .from('companions')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (companionError || !companion) {
      return { earnings: { week: 0, month: 0, year: 0, total: 0 }, error: companionError };
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get completed bookings
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('subtotal, created_at')
      .eq('companion_id', companion.id)
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching earnings:', error);
      return { earnings: { week: 0, month: 0, year: 0, total: 0 }, error };
    }

    let week = 0, month = 0, year = 0, total = 0;

    (bookings || []).forEach(booking => {
      const bookingDate = new Date(booking.created_at);
      const amount = booking.subtotal * 0.9; // Companion gets 90%

      total += amount;
      if (bookingDate >= yearAgo) year += amount;
      if (bookingDate >= monthAgo) month += amount;
      if (bookingDate >= weekAgo) week += amount;
    });

    return { earnings: { week, month, year, total }, error: null };
  } catch (err) {
    console.error('Error in fetchCompanionEarnings:', err);
    return { earnings: { week: 0, month: 0, year: 0, total: 0 }, error: err as Error };
  }
}
