import { IDataMapper } from "./json-data-mapper";
import { JsonDataMapper } from "./json-data-mapper";
export interface ApiResponseWrapper<T> {
  data: T;
  status: string;
  message?: string;
}

export class ApiResponseAdapter<T> implements IDataMapper<ApiResponseWrapper<T>, T> {
  map(source: ApiResponseWrapper<T>): T {
    return source.data;
  }
}

export interface SnakeCaseUser {
  user_id: string;
  user_name: string;
  email_address: string;
}

export interface CamelCaseUser {
  userId: string;
  userName: string;
  emailAddress: string;
}

export class SnakeCaseUserAdapter implements IDataMapper<SnakeCaseUser, CamelCaseUser> {
  map(source: SnakeCaseUser): CamelCaseUser {
    return {
      userId: source.user_id,
      userName: source.user_name,
      emailAddress: source.email_address,
    };
  }
}


interface Product {
  id: string;
  name: string;
  price: number;
}

const productApiData: ApiResponseWrapper<Product> = {
  data: {
    id: 'prod_123',
    name: 'Example Product',
    price: 99.99,
  },
  status: 'success',
  message: 'Product fetched successfully',
};

const productMapper = new JsonDataMapper<ApiResponseWrapper<Product>, Product>(new ApiResponseAdapter<Product>());
const product = productMapper.map(productApiData);
console.log('Mapped Product:', product);

const snakeCaseUserData: SnakeCaseUser = {
  user_id: 'user_456',
  user_name: 'john_doe',
  email_address: 'john.doe@example.com',
};

const userMapper = new JsonDataMapper<SnakeCaseUser, CamelCaseUser>(new SnakeCaseUserAdapter());
const user = userMapper.map(snakeCaseUserData);
console.log('Mapped User:', user);
