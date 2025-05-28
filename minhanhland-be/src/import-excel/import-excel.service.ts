import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Repository } from 'typeorm';
import { MasterDataEntity } from 'src/master-data/entities/master-data.entity';
import { MasterDataType, ProductStatus } from 'src/common/enums';
import * as path from 'path';
import { Injectable } from '@nestjs/common';

// Interface để định nghĩa mapping giữa header và field
interface HeaderMapping {
  [key: string]: string; // header name -> field name
}

@Injectable()
export class ImportExcelService {
  // Định nghĩa mapping giữa header và field với các biến thể
  private readonly headerMapping: HeaderMapping = {
    'Tòa': 'apartmentCode',
    'Mã Căn TK': 'apartmentCode',
    'Mã shop': 'apartmentCode',
    'Mã': 'apartmentCode',
    'Mã căn': 'apartmentCode',
    'Ma can': 'apartmentCode',

    // Diện tích - các biến thể
    'Diện Tích': 'area',
    'Dien tich': 'area',
    'DT': 'area',
    'S': 'area',

    // Giá bán - các biến thể
    'Giá bán': 'sellingPrice',
    'Gia ban': 'sellingPrice',
    'Giá': 'sellingPrice',
    'Gia': 'sellingPrice',

    // Thuế - các biến thể
    'Thuế phí': 'tax',
    'thuế + phí cc': 'tax',
    'thuế phí': 'tax',
    'thuế': 'tax',

    // Ghi chú nội thất
    'Nội thất': 'furnitureNote',
    'Noi that': 'furnitureNote',

    // Thông tin thế chấp
    'TT Sổ Đỏ - Vay': 'mortgageInfo',
    // Mô tả
    'Mô tả': 'description',
    'Mo ta': 'description',
    'Description': 'description',
    'Desc': 'description',
    'Chi tiết': 'description',
    'Chi tiet': 'description',

    // Hướng ban công
    'Hướng BC': 'balconyDirection',
    'View BC': 'balconyDirection',
    'Huong ban cong': 'balconyDirection',
    'Ban công': 'balconyDirection',
    'Ban cong': 'balconyDirection',
    'Hướng': 'balconyDirection',
    'Huong': 'balconyDirection',
    'Direction': 'balconyDirection',
    'Balcony Direction': 'balconyDirection',

    // Trạng thái
    'Trạng thái': 'status',
    'Trang thai': 'status',
    'Status': 'status',
    'Tình trạng': 'status',
    'Tinh trang': 'status',

    // Liên hệ
    'Liên hệ': 'contact',
    'Lien he': 'contact',
    'Contact': 'contact',
    'SĐT': 'contact',
    'SDT': 'contact',
    'Số điện thoại': 'contact',
    'So dien thoai': 'contact',
    'Phone': 'contact',
    'Điện thoại': 'contact',
    'Dien thoai': 'contact',

    // Nguồn
    'Nguồn': 'source',
    'Nguon': 'source',
    'Source': 'source',
    'Kênh': 'source',
    'Kenh': 'source',
    'Liên hệ/ báo nguồn': 'source',
    'Lưu ý': 'description',
    'Ghi chú': 'description',
  };

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(MasterDataEntity)
    private readonly masterDataRepo: Repository<MasterDataEntity>,
  ) { }

  async importExcelFiles(files: Express.Multer.File[]) {
    const importedProducts = [];

    for (const file of files) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      const fileName = path.parse(file.originalname).name;

      for (const worksheet of workbook.worksheets) {
        // Đọc header từ row đầu tiên
        const headerRow = worksheet.getRow(1);

        // Debug: Log mapping information
        this.logColumnMapping(headerRow);

        const columnMapping = this.createColumnMapping(headerRow);

        // Bắt đầu từ row 2 (skip header)
        for (let i = 2; i <= worksheet.rowCount; i++) {
          const row = worksheet.getRow(i);

          // Skip empty rows
          if (this.isEmptyRow(row)) continue;

          const product = await this.mapRowToEntity(row, columnMapping, fileName, worksheet.name);
          if (product) importedProducts.push(product);
        }
      }

      fs.unlinkSync(file.path);
    }

    await this.productRepo.save(importedProducts);
    return { importedCount: importedProducts.length };
  }

  /**
   * Tạo mapping giữa column index và field name dựa trên header với fuzzy matching
   */
  private createColumnMapping(headerRow: ExcelJS.Row): Map<string, number> {
    const columnMapping = new Map<string, number>();

    headerRow.eachCell((cell, colNumber) => {
      const headerText = cell.value?.toString().trim();
      if (!headerText) return;

      // Tìm exact match trước
      const exactMatch = Object.keys(this.headerMapping).find(key =>
        this.normalizeText(key) === this.normalizeText(headerText)
      );

      if (exactMatch) {
        const fieldName = this.headerMapping[exactMatch];
        columnMapping.set(fieldName, colNumber);
        return;
      }

      // Nếu không có exact match, tìm fuzzy match
      const fuzzyMatch = this.findBestHeaderMatch(headerText);
      if (fuzzyMatch) {
        const fieldName = this.headerMapping[fuzzyMatch.header];
        columnMapping.set(fieldName, colNumber);
        console.log(`Fuzzy matched: "${headerText}" -> "${fuzzyMatch.header}" (similarity: ${fuzzyMatch.similarity.toFixed(2)})`);
      } else {
        console.warn(`No match found for header: "${headerText}"`);
      }
    });

    return columnMapping;
  }

  /**
   * Chuẩn hóa text để so sánh
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
      .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
      .replace(/[ìíịỉĩ]/g, 'i')
      .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
      .replace(/[ùúụủũưừứựửữ]/g, 'u')
      .replace(/[ỳýỵỷỹ]/g, 'y')
      .replace(/đ/g, 'd')
      .replace(/[^\w\s]/g, ''); // Remove special characters
  }

  /**
   * Tính toán độ tương đồng giữa 2 chuỗi (Levenshtein distance)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const norm1 = this.normalizeText(str1);
    const norm2 = this.normalizeText(str2);

    if (norm1 === norm2) return 1;

    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);

    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  /**
   * Tính Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Tìm header khớp nhất với input text
   */
  private findBestHeaderMatch(inputHeader: string): { header: string; similarity: number } | null {
    const threshold = 0.6; // Ngưỡng tương đồng tối thiểu (60%)
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const headerKey of Object.keys(this.headerMapping)) {
      const similarity = this.calculateSimilarity(inputHeader, headerKey);

      if (similarity > bestSimilarity && similarity >= threshold) {
        bestSimilarity = similarity;
        bestMatch = headerKey;
      }
    }

    return bestMatch ? { header: bestMatch, similarity: bestSimilarity } : null;
  }

  /**
   * Kiểm tra xem header có chứa các từ khóa quan trọng không
   */
  private containsKeywords(inputHeader: string, targetHeader: string): boolean {
    const inputWords = this.normalizeText(inputHeader).split(' ');
    const targetWords = this.normalizeText(targetHeader).split(' ');

    // Kiểm tra xem có ít nhất 70% từ khóa trùng khớp không
    const matchingWords = targetWords.filter(word =>
      inputWords.some(inputWord => inputWord.includes(word) || word.includes(inputWord))
    );

    return matchingWords.length / targetWords.length >= 0.7;
  }

  /**
   * Kiểm tra row có empty không
   */
  private isEmptyRow(row: ExcelJS.Row): boolean {
    let hasValue = false;
    row.eachCell((cell) => {
      if (cell.value !== null && cell.value !== undefined && cell.value.toString().trim() !== '') {
        hasValue = true;
      }
    });
    return !hasValue;
  }

  /**
   * Lấy giá trị từ row theo field name
   */
  private getValueByField(row: ExcelJS.Row, fieldName: string, columnMapping: Map<string, number>): any {
    let columnIndex = columnMapping.get(fieldName);
    if (!columnIndex)
      return null;

    const cell = row.getCell(columnIndex);
    return cell.value;
  }

  private async mapRowToEntity(
    row: ExcelJS.Row,
    columnMapping: Map<string, number>,
    fileName: string,
    sheetName: string
  ): Promise<Product | null> {
    const subdivision = await this.getOrCreateMasterData(fileName, MasterDataType.TOA_NHA);
    const apartmentType = await this.getOrCreateMasterData(sheetName, MasterDataType.LOAI_CAN_HO, subdivision);

    // Helper function để lấy giá trị theo field name
    const getValue = (fieldName: string) => this.getValueByField(row, fieldName, columnMapping);

    const parseArea = (val: any) => {
      if (typeof val === 'string') {
        const match = val.match(/([\d.]+)/);
        return match ? parseFloat(match[1]) : null;
      }
      return typeof val === 'number' ? val : null;
    };

    // Kiểm tra các field bắt buộc
    const apartmentCode = getValue('apartmentCode')?.toString().trim();
    const buildingCode = getValue('buildingCode')?.toString().trim() || this.extractBuildingCodeFromApartment(apartmentCode);

    if (!apartmentCode) {
      console.warn(`Skipping row: Missing required fields (apartmentCode: ${apartmentCode})`);
      return null;
    }

    const product = new Product();

    // Map dữ liệu theo field name
    product.buildingCode = buildingCode;
    product.apartmentCode = apartmentCode;
    product.apartmentEncode = getValue('apartmentEncode')?.toString().trim() || this.updateEncode(apartmentCode);
    product.area = parseArea(getValue('area'));
    product.sellingPrice = getValue('sellingPrice')?.toString().trim() || null;
    product.tax = getValue('tax') ? this.parseMoney(getValue('tax')) : null;
    product.furnitureNote = getValue('furnitureNote')?.toString().trim() || null;
    product.mortgageInfo = getValue('mortgageInfo')?.toString().trim() || null;
    product.description = getValue('description')?.toString().trim() || null;

    const balconyDirection = getValue('balconyDirection')?.toString().trim();
    product.balconyDirection = balconyDirection ? this.convertDirection(balconyDirection) : null;

    const statusRaw = getValue('status')?.toString().trim();
    product.status = this.mapStatusTextToEnum(statusRaw);

    const contact = getValue('contact')?.toString().trim();
    product.apartmentContactInfo = contact || '';
    product.contactInfo = contact || '';

    product.source = getValue('source')?.toString().trim() || null;
    product.subdivision = subdivision;
    product.apartmentType = apartmentType;
    product.imageList = [];

    return product;
  }

  public updateEncode(apartmentCode: string): string {
    const code = apartmentCode || '';
    if (code.length >= 3) {
      const index = code.length - 3;
      return code.substring(0, index) + 'x' + code.substring(index + 1);
    } else {
      return '';
    }
  }

  /**
   * Cập nhật header mapping (có thể gọi từ bên ngoài để customize)
   */
  public updateHeaderMapping(newMapping: HeaderMapping): void {
    Object.assign(this.headerMapping, newMapping);
  }

  /**
   * Log thông tin mapping để debug
   */
  public logColumnMapping(headerRow: ExcelJS.Row): void {
    console.log('=== HEADER MAPPING DEBUG ===');

    headerRow.eachCell((cell, colNumber) => {
      const headerText = cell.value?.toString().trim();
      if (!headerText) return;

      const exactMatch = Object.keys(this.headerMapping).find(key =>
        this.normalizeText(key) === this.normalizeText(headerText)
      );

      if (exactMatch) {
        console.log(`✅ Column ${colNumber}: "${headerText}" -> ${this.headerMapping[exactMatch]} (exact match)`);
      } else {
        const fuzzyMatch = this.findBestHeaderMatch(headerText);
        if (fuzzyMatch) {
          console.log(`🔍 Column ${colNumber}: "${headerText}" -> ${this.headerMapping[fuzzyMatch.header]} (fuzzy: ${fuzzyMatch.similarity.toFixed(2)})`);
        } else {
          console.log(`❌ Column ${colNumber}: "${headerText}" -> No match found`);
        }
      }
    });

    console.log('=== END DEBUG ===');
  }

  private async getOrCreateMasterData(
    name: string,
    type: MasterDataType,
    parent?: MasterDataEntity,
  ): Promise<MasterDataEntity> {
    const where: any = { name, type };
    if (parent) where.parent = { id: parent.id };

    const existing = await this.masterDataRepo.findOne({
      where,
      relations: ['parent'],
    });

    if (existing) return existing;

    const master = this.masterDataRepo.create({
      name,
      type,
      parent: parent ?? null,
    });

    return this.masterDataRepo.save(master);
  }

  private mapStatusTextToEnum(text: string): ProductStatus {
    const normalized = text?.trim().toLowerCase();

    switch (normalized) {
      case 'đang bán':
        return ProductStatus.DANG_BAN;
      case 'tạm dừng':
        return ProductStatus.TAM_DUNG;
      case 'đã bán':
        return ProductStatus.DA_BAN;
      default:
        return ProductStatus.DANG_BAN;
    }
  }

  /**
   * Chuyển đổi viết tắt hướng thành text đầy đủ
   * @param direction - Chuỗi viết tắt hướng (VD: "Đ", "ĐN", "TB"...)
   * @returns Text đầy đủ của hướng hoặc chuỗi gốc nếu không tìm thấy
   */
  private convertDirection(direction: string): string {
    // Map các viết tắt hướng tiếng Việt
    const directionMap: Record<string, string> = {
      // Hướng chính
      'Đ': 'Đông',
      'T': 'Tây',
      'N': 'Nam',
      'B': 'Bắc',

      // Hướng phụ (8 hướng)
      'ĐN': 'Đông Nam',
      'ĐB': 'Đông Bắc',
      'TN': 'Tây Nam',
      'TB': 'Tây Bắc',

      // Các cách viết khác
      'Đông': 'Đông',
      'Tây': 'Tây',
      'Nam': 'Nam',
      'Bắc': 'Bắc',
      'Đông Nam': 'Đông Nam',
      'Đông Bắc': 'Đông Bắc',
      'Tây Nam': 'Tây Nam',
      'Tây Bắc': 'Tây Bắc',
    };

    // Loại bỏ khoảng trắng và chuẩn hóa
    const normalized = direction.trim().toUpperCase();

    // Tìm trong map
    const result = directionMap[normalized];

    // Trả về kết quả hoặc chuỗi gốc nếu không tìm thấy
    return result || direction;
  }

  private parseMoney(value: any): number | null {
    if (!value) return null;

    const str = value.toString().toLowerCase().trim();

    // Lấy phần số trước các hậu tố như tr, triệu, tỷ, v.v.
    const match = str.match(/([\d.,]+)/);
    if (!match) return null;

    // Chuyển dấu , sang . nếu có
    let num = parseFloat(match[1].replace(',', '.'));

    return isNaN(num) ? null : num;
  }

  private extractBuildingCodeFromApartment(apartmentCode: string): string {
    if (!apartmentCode || apartmentCode.length <= 4) {
      return ''; // Trả về chuỗi rỗng nếu null, undefined hoặc quá ngắn
    }

    const cleaned = apartmentCode.replace(/\./g, '');
    return cleaned.length > 4 ? cleaned.slice(0, -4) : '';
  }

}