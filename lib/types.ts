export type WidgetType = 'card' | 'table' | 'chart';

export interface WidgetField {
  id: string;
  label: string;
  path: string;
}

export interface WidgetConfig {
  label: string;
  apiUrl: string;
  socketUrl?: string;
  socketSubscribe?: any;
  apiKey?: string;
  apiKeyParam?: string;
  refreshInterval: number;
  fields: WidgetField[];
  rootPath?: string;
}

export interface Widget {
  id: string;
  type: WidgetType;
  config: WidgetConfig;
}
