export interface WeatherForecast {
  model: string
  forecast_date: string
  member_values: number[]
  probability_above: Record<string, number>
}

export interface CityWeather {
  city: string
  lat: number
  lon: number
  forecasts: WeatherForecast[]
  fetched_at: string
}

export interface CityDetailForecast {
  forecast_date: string
  models: Record<string, {
    member_values: number[]
    probability_above: Record<string, number>
    mean: number | null
    min: number | null
    max: number | null
    member_count: number
  }>
}

export interface CityDetail {
  city: string
  lat: number | null
  lon: number | null
  fetched_at: string | null
  forecasts: CityDetailForecast[]
}
