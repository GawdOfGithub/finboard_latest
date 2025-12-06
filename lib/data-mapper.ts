export interface DataMapper<T, U> {
  map(source: T): U;
}

export interface ApiAdapter<T> {
  adapt(data: any): T;
}

export class NoOpAdapter<T> implements ApiAdapter<T> {
  adapt(data: any): T {
    return data as T;
  }
}
