export const FILTERS: Record<string, { multi?: boolean; options: [string, string][]; none: string }> = {
  quakes: { options: [['', 'Alle'], ['4', 'ab M 4'], ['5', 'ab M 5'], ['6', 'ab M 6']], none: '' },
  aircraft: {
    multi: true,
    options: [['plane', 'Flugzeuge'], ['heli', 'Hubschrauber'], ['glider', 'Segelflug'], ['drone', 'Drohnen'], ['balloon', 'Ballone'], ['mil', 'Nur Militär']],
    none: '',
  },
  // Unteroptionen von "Blitze Live": Ton bei jedem Einschlag, schrumpfender Kreis, Detektoren, Linien und Donner
  lightning: {
    multi: true,
    options: [['sound', 'Ton'], ['wave', 'Einschlagskreis'], ['detectors', 'Detektoren'], ['lines', 'Detektor-Linien'], ['thunder', 'Donner']],
    none: '',
  },
};
