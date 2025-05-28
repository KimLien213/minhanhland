export class MasterDataResponseDto {
  id: string;
  name: string;
  description?: string | null;

  constructor(entity: Partial<MasterDataResponseDto>) {
    if (!entity) {
      return;
    }
    this.id = entity.id;
    this.name = entity.name;
    this.description = entity.description;
  }
}
