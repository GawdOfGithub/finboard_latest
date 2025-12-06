export interface IDataMapper<Source, Target> {
  map(source: Source): Target;
}

export class JsonDataMapper<Source, Target> implements IDataMapper<Source, Target> {
  private adapter: IDataMapper<Source, Target>;

  constructor(adapter: IDataMapper<Source, Target>) {
    this.adapter = adapter;
  }

  map(source: Source): Target {
    return this.adapter.map(source);
  }
}
