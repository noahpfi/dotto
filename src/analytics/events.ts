// durations in _ms, ratios 0 to 1, no personal identifiers
export type DottoEvent =
  // returning comes from local save, not cross-device identity
  | { name: 'home_viewed'; props: { unlocked_level: number; attempts: number; returning: boolean } }
  | { name: 'prediction_shown'; props: { level_id: number } }
  | {
      name: 'prediction_answered';
      props: {
        predicted_ms: number;
        chosen_level_id: number;
        // level really run, higher than chosen when claim exceeded it
        run_level_id: number;
        raised: boolean;
      };
    }
  | {
      name: 'run_started';
      props: {
        level_id: number;
        target_ms: number;
        predicted_ms: number | null;
        is_prediction_run: boolean;
        attempt_number: number;
      };
    }
  // index is 1-based within run
  | { name: 'probe_shown'; props: { level_id: number; index: number; elapsed_ms: number; window_ms: number } }
  // reaction time = product's only behavioural measurement
  | { name: 'probe_answered'; props: { level_id: number; index: number; reaction_ms: number } }
  | { name: 'probe_missed'; props: { level_id: number; index: number; elapsed_ms: number } }
  | {
      name: 'run_ended';
      props: {
        level_id: number;
        passed: boolean;
        // null when passed
        reason: string | null;
        survived_ms: number;
        target_ms: number;
        // primary segmentation metric
        completion_ratio: number;
        probes_shown: number;
        probes_hit: number;
        predicted_ms: number | null;
        // below 1 = overclaimed
        prediction_ratio: number | null;
        is_prediction_run: boolean;
      };
    }
  | { name: 'level_unlocked'; props: { level_id: number } }
  | {
      name: 'result_viewed';
      props: { level_id: number; passed: boolean; reason: string | null; survived_ms: number; dwell_percentile: number };
    }
  | { name: 'share_clicked'; props: { source: string; level_id: number; passed: boolean; survived_ms: number } }
  | { name: 'share_completed'; props: { source: string; method: 'web-share' | 'clipboard' } }
  | { name: 'share_dismissed'; props: { source: string } }
  | { name: 'share_failed'; props: { source: string } }
  // fake-door tap, rate decides whether app gets built
  | { name: 'app_intent'; props: { source: string; survived_ms: number | null; predicted_ms: number | null } }
  | { name: 'waitlist_submitted'; props: { source: string } }
  | { name: 'waitlist_failed'; props: { source: string; status: number | null } };

export type DottoEventName = DottoEvent['name'];

export type PropsFor<N extends DottoEventName> = Extract<DottoEvent, { name: N }>['props'];
