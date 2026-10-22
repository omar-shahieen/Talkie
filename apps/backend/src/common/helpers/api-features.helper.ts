import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';

export class APIFeatures<T extends ObjectLiteral> {
  private qb: SelectQueryBuilder<T>;
  private readonly alias: string;
  constructor(
    repository: Repository<T>,
    private readonly queryString: PaginationDto,
  ) {
    this.alias = repository.metadata.tableName; // e.g. "user"
    this.qb = repository.createQueryBuilder(this.alias);
  }
  filter() {
    const excluded = new Set(['page', 'sort', 'limit', 'fields']);

    const filters = Object.entries(this.queryString).filter(
      ([key, val]) => !excluded.has(key) && val !== undefined,
    );

    filters.forEach(([key, val], i) => {
      const param = `filter_${key}_${i}`;
      const col = `${this.alias}.${key}`;
      if (i == 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.qb.where(`${col} = :${param}`, { [param]: val });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.qb.andWhere(`${col} = :${param}`, { [param]: val });
      }
    });

    return this;
  }

  limit() {
    if (this.queryString.fields) {
      const cols = this.queryString.fields
        .split(',')
        .map((f) => `${this.alias}.${f.trim()}`);

      this.qb.select(cols);
    }
    return this;
  }

  pagination() {
    const limit = this.queryString.limit || 10;

    const skip = this.queryString.skip;

    this.qb.skip(skip).take(limit);

    return this;
  }
  sorting() {
    if (this.queryString.sort) {
      // "name,-createdAt"  →  ORDER BY name ASC, createdAt DESC
      this.queryString.sort.split(',').forEach((field) => {
        const order = field.startsWith('-') ? 'DESC' : 'ASC';
        const col = field.replace(/^-/, '');
        this.qb.addOrderBy(`${this.alias}.${col}`, order);
      });
    } else {
      this.qb.orderBy(`${this.alias}.createdAt`, 'DESC');
    }

    return this;
  }

  // Excute commands
  async getMany(): Promise<T[]> {
    return this.qb.getMany();
  }

  async getManyAndCount(): Promise<[T[], number]> {
    return this.qb.getManyAndCount();
  }
}
