import { supabase } from '../supabase';
import type {
  MeetupLocationProposal,
  MeetupResponseAction,
} from '../../types';
import type { CreateBookingWithMeetupInput, BookingData } from './bookingsApi';
import { createBookingWithMeetup } from './bookingsApi';

type RawRecord = Record<string, unknown>;

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeProposal(row: RawRecord): MeetupLocationProposal {
  return {
    id: String(row.id || ''),
    conversationId: String(row.conversation_id || ''),
    bookingId: toOptionalString(row.booking_id),
    proposerUserId: String(row.proposer_user_id || ''),
    placeId: toOptionalString(row.place_id),
    placeName: String(row.place_name || 'Meetup location'),
    placeAddress: toOptionalString(row.place_address),
    latitude: toOptionalNumber(row.latitude),
    longitude: toOptionalNumber(row.longitude),
    note: toOptionalString(row.note),
    status: (
      ['pending', 'accepted', 'declined', 'countered', 'withdrawn'].includes(String(row.status))
        ? String(row.status)
        : 'pending'
    ) as MeetupLocationProposal['status'],
    responseByUserId: toOptionalString(row.response_by_user_id),
    responseNote: toOptionalString(row.response_note),
    respondedAt: toOptionalString(row.responded_at),
    supersedesProposalId: toOptionalString(row.supersedes_proposal_id),
    acceptedAt: toOptionalString(row.accepted_at),
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export interface ProposeMeetupInput {
  conversationId: string;
  bookingId?: string;
  placeId?: string;
  placeName: string;
  placeAddress?: string;
  latitude?: number;
  longitude?: number;
  note?: string;
  supersedesProposalId?: string;
}

export interface RespondMeetupInput {
  proposalId: string;
  action: MeetupResponseAction;
  responseNote?: string;
  counterPlaceId?: string;
  counterPlaceName?: string;
  counterPlaceAddress?: string;
  counterLatitude?: number;
  counterLongitude?: number;
}

export async function createBookingWithMeetupProposal(
  input: CreateBookingWithMeetupInput,
): Promise<{ booking: BookingData | null; error: Error | null }> {
  return createBookingWithMeetup(input);
}

export async function proposeMeetupLocation(
  input: ProposeMeetupInput,
): Promise<{ proposal: MeetupLocationProposal | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('propose_meetup_location_v1', {
      p_conversation_id: input.conversationId,
      p_booking_id: input.bookingId ?? null,
      p_place_id: input.placeId ?? null,
      p_place_name: input.placeName,
      p_place_address: input.placeAddress ?? null,
      p_latitude: input.latitude ?? null,
      p_longitude: input.longitude ?? null,
      p_note: input.note ?? null,
      p_supersedes_proposal_id: input.supersedesProposalId ?? null,
    });

    if (error) {
      return { proposal: null, error: new Error(error.message || 'Unable to propose meetup location.') };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') {
      return { proposal: null, error: new Error('Meetup proposal response was empty.') };
    }

    return { proposal: normalizeProposal(row as RawRecord), error: null };
  } catch (error) {
    return {
      proposal: null,
      error: error instanceof Error ? error : new Error('Unable to propose meetup location.'),
    };
  }
}

export async function respondToMeetupProposal(
  input: RespondMeetupInput,
): Promise<{ success: boolean; counterProposalId?: string; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('respond_meetup_location_v1', {
      p_proposal_id: input.proposalId,
      p_action: input.action,
      p_response_note: input.responseNote ?? null,
      p_counter_place_id: input.counterPlaceId ?? null,
      p_counter_place_name: input.counterPlaceName ?? null,
      p_counter_place_address: input.counterPlaceAddress ?? null,
      p_counter_latitude: input.counterLatitude ?? null,
      p_counter_longitude: input.counterLongitude ?? null,
    });

    if (error) {
      return { success: false, error: new Error(error.message || 'Unable to update meetup proposal.') };
    }

    const row = Array.isArray(data) ? data[0] : data;
    const counterProposalId = row && typeof row === 'object'
      ? toOptionalString((row as RawRecord).counter_proposal_id)
      : undefined;

    return { success: true, counterProposalId, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unable to update meetup proposal.'),
    };
  }
}

export async function listMeetupProposals(input: {
  conversationId: string;
  bookingId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ proposals: MeetupLocationProposal[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('list_meetup_location_proposals_v1', {
      p_conversation_id: input.conversationId,
      p_booking_id: input.bookingId ?? null,
      p_limit: input.limit ?? 200,
      p_offset: input.offset ?? 0,
    });

    if (error) {
      return { proposals: [], error: new Error(error.message || 'Unable to load meetup proposals.') };
    }

    const rows = Array.isArray(data) ? data : [];
    return {
      proposals: rows
        .filter((row): row is RawRecord => !!row && typeof row === 'object')
        .map((row) => normalizeProposal(row)),
      error: null,
    };
  } catch (error) {
    return {
      proposals: [],
      error: error instanceof Error ? error : new Error('Unable to load meetup proposals.'),
    };
  }
}

export function subscribeToMeetupProposals(
  conversationId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`meetup_proposals:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'meetup_location_proposals',
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function findLatestAgreedMeetup(
  proposals: MeetupLocationProposal[],
): MeetupLocationProposal | null {
  const agreed = proposals
    .filter((proposal) => proposal.status === 'accepted')
    .sort((a, b) => new Date(b.acceptedAt || b.updatedAt).getTime() - new Date(a.acceptedAt || a.updatedAt).getTime());
  return agreed[0] || null;
}
