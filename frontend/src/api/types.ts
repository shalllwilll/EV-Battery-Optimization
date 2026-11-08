import type { components } from './schema'

type S = components['schemas']
export type Scenario = S['Scenario']
export type Labelled = S['Labelled']
export type PredictionResult = S['PredictionResult']
export type CompareResult = S['CompareResult']
export type RecommendResponse = S['RecommendResponse']
export type PresetResult = S['PresetResult']
export type Stage = S['Stage']
export type Metrics = S['Metrics']
export type LeverChange = S['LeverChange']
export type ReplacementResult = S['ReplacementResult']
export type LoginResponse = S['LoginResponse']

/** Reference endpoints are not typed in OpenAPI (plain dicts), so their shapes live here. */
export type FieldSpec = { value: Labelled; range?: Labelled }
export type ArchetypePreset = { id: string; label: string; fields: Record<string, FieldSpec>; scenario: Scenario }
export type PresetsResponse = { mode: 'prior'; presets: ArchetypePreset[] }
export type ZoneMonth = { month: number; tmean_c: number; tmax_mean_c: number; tmin_mean_c: number; tmax_p95_c: number; diurnal_range_c: number; n_days: number }
export type Zone = { id: string; label: string; elevation_m: number; lat: number; lon: number; monthly: ZoneMonth[] }
export type ZonesResponse = { period: string; note: string; provenance: { source_url: string; licence: string; attribution: string; limitations: string; synthetic: boolean }; zones: Zone[] }
export type Dataset = { id: string; used_for: string; chemistry?: string; licence: string; limitations: string; source_url: string; synthetic: boolean; retrieved_for_project: string }
export type CalibrationRun = { results: { n_labels: number; prior_mape: number; no_pooling_mape: number; partial_pooling_mape: number; vehicles_not_worse_pct: number }[]; tau_ah: number; sigma_ah: number; vehicles_evaluated: number }
export type LossSplit = Record<'5y' | '10y', { calendar_loss: number; cycle_loss: number }>
export type CrosscheckScenario = {
  id: string; label: string; archetype: string; zone: string
  efc_per_year: { ours: number; blast: number }; c_rate_eff: number
  years: number[]
  ours_p10: number[]; ours_p50: number[]; ours_p90: number[]; ours_cell_p50: number[]; blast: number[]; blast_alt: number[]
  loss_split: { ours: LossSplit; blast_250ah: LossSplit; blast_sony_3ah: LossSplit }
  years_to_80: { ours_p50: number | null; ours_cell_p50: number | null; blast: number | null; blast_alt: number | null }
}
export type CrosscheckCheck = {
  kind: 'storage' | 'cycling'; label: string
  ours: Record<string, number>; blast_250ah: Record<string, number>; blast_sony_3ah: Record<string, number>
}
export type Crosscheck = {
  generated: string; what: string; threshold: number; horizon_years: number
  blast_lite: { version: string; python: string; model: string; source_url: string; kind: string }
  method: string[]; caveats: string[]
  summary: { same_direction_of_levers: boolean; blast_inside_our_band_share: number; ours_is_lower_in_all_scenarios: boolean
    levers: { id: string; label: string; ours_cell_change_pts_at_10y: number; blast_250ah_change_pts_at_10y: number; blast_sony_change_pts_at_10y: number }[] }
  single_condition_checks: CrosscheckCheck[]
  scenarios: CrosscheckScenario[]
}
export type EvidenceResponse = {
  mode: 'prior'
  validated_on_buses: false
  model_version: string
  datasets: Dataset[]
  metrics: {
    calendar_validation: { cross_lab: Record<string, { conditions: number; mae_all: number; mae_within_train_horizon: number }>; overlap: string; passes_threshold: boolean; threshold: number }
    early_life: { candidates: { model: string; mape: number; within15: number }[]; improvement_vs_mean_pct_points: number; improvement_ci95: [number, number]; winner: string }
    evbattery_capacity: { mileage_only: { mape: number; within5: number }; snippet_features: { mape: number; within5: number }; chemistry: string; caveat: string; split: string }
    calibration_demo: { with_snippet_features: CalibrationRun; mileage_only: CalibrationRun; vehicles: number; rows: number; split: string; evaluation: string; chemistry: string; caveat: string }
    uncertainty: { calendar: { coverage_point_weighted: number; coverage_condition_mean: number }; cycle: { coverage_cell_mean: number; coverage_point_weighted: number; n_cells: number } }
  }
  uncertainty: { extrapolation_widening: number; extrapolation_widening_note: string; nominal_band: string }
  crosscheck: Crosscheck | null
  training_coverage: { cycling_temperature_c: [number, number]; cycling_c_rate: [number, number]; cycling_efc_max: number }
  limitations: string[]
}
