// On-demand buses ("Rufbus", Transitous mode ODM / FLEX) have to be booked by phone. Transitous only says that a
// booking is needed (`reservation`), not whom to call, so the numbers of the operators are kept here, by agency
// name as Transitous gives it. Add a line when another region should show its number.

export interface RufbusInfo {
  /** phone number as it is written */
  tel: string;
  /** how many minutes before departure the ride has to be booked */
  leadMin: number;
}

const AGENCIES: Record<string, RufbusInfo> = {
  Nordwestmecklenburg: { tel: '0385 55573340', leadMin: 60 },
};

/** booking info of an on-demand ride: the operator's number when known, otherwise just that a booking is needed */
export function rufbusInfo(agency: string | undefined, reservation: string | undefined): (Partial<RufbusInfo> & { required: boolean }) | null {
  const known = agency ? AGENCIES[agency] : undefined;
  if (known) return { ...known, required: true };
  return reservation === 'COMPULSORY' ? { required: true } : null;
}

/** `tel:` link target of a written number */
export const telHref = (tel: string) => `tel:${tel.replace(/[^\d+]/g, '')}`;
