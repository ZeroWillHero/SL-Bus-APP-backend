import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getDataSourceOptions } from './typeorm.options';

export default new DataSource(getDataSourceOptions());
