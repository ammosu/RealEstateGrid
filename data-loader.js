/**
 * 多來源房地產資料載入工具
 * 支援 S3、CSV 檔案、資料庫三種資料來源
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { convertROCtoAD } from './data-processor.js';

/**
 * 從 AWS S3 載入資料
 * @param {string} s3Url - S3 URL (例如: https://bucket-name.s3.region.amazonaws.com/data.json)
 * @param {object} options - 載入選項
 * @returns {Promise<Array>} 處理後的資料陣列
 */
export async function loadFromS3(s3Url, options = {}) {
  const { format = 'json' } = options;

  console.log(`正在從 S3 載入資料：${s3Url}`);

  try {
    const response = await fetch(s3Url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');

    if (format === 'json' || contentType?.includes('application/json')) {
      // JSON 格式
      const data = await response.json();
      console.log(`從 S3 載入 ${data.length} 筆 JSON 資料`);
      return validateAndProcessData(data, options);
    } else if (format === 'csv' || contentType?.includes('text/csv')) {
      // CSV 格式
      const text = await response.text();
      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        bom: true
      });
      console.log(`從 S3 載入 ${records.length} 筆 CSV 資料`);
      return processCSVRecords(records, options);
    } else {
      throw new Error(`不支援的資料格式：${contentType}`);
    }
  } catch (error) {
    console.error('從 S3 載入資料失敗：', error.message);
    throw error;
  }
}

/**
 * 從本地 CSV 檔案載入資料
 * @param {string} filePath - CSV 檔案路徑
 * @param {object} options - 載入選項
 * @returns {Promise<Array>} 處理後的資料陣列
 */
export async function loadFromCSV(filePath, options = {}) {
  console.log(`正在從 CSV 檔案載入資料：${filePath}`);

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      bom: true
    });

    console.log(`從 CSV 載入 ${records.length} 筆原始資料`);
    return processCSVRecords(records, options);
  } catch (error) {
    console.error('從 CSV 載入資料失敗：', error.message);
    throw error;
  }
}

/**
 * 從本地 JSON 檔案載入資料
 * @param {string} filePath - JSON 檔案路徑
 * @param {object} options - 載入選項
 * @returns {Promise<Array>} 處理後的資料陣列
 */
export async function loadFromJSON(filePath, options = {}) {
  console.log(`正在從 JSON 檔案載入資料：${filePath}`);

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    console.log(`從 JSON 載入 ${data.length} 筆資料`);
    return validateAndProcessData(data, options);
  } catch (error) {
    console.error('從 JSON 載入資料失敗：', error.message);
    throw error;
  }
}

/**
 * 從資料庫載入資料（PostgreSQL 範例）
 * @param {object} dbConfig - 資料庫連線設定
 * @param {string} query - SQL 查詢語句
 * @param {object} options - 載入選項
 * @returns {Promise<Array>} 處理後的資料陣列
 */
export async function loadFromDatabase(dbConfig, query, options = {}) {
  console.log('正在從資料庫載入資料...');

  try {
    // 這裡使用 pg (PostgreSQL) 作為範例
    // 實際使用時需要先安裝：npm install pg
    const { default: pg } = await import('pg');
    const { Client } = pg;

    const client = new Client(dbConfig);
    await client.connect();

    const result = await client.query(query);
    await client.end();

    console.log(`從資料庫載入 ${result.rows.length} 筆資料`);
    return processDatabaseRecords(result.rows, options);
  } catch (error) {
    console.error('從資料庫載入資料失敗：', error.message);
    throw error;
  }
}

/**
 * 處理 CSV 記錄並轉換為標準格式
 */
function processCSVRecords(records, options = {}) {
  const {
    minPrice = 100000,
    maxPrice = 2000000,
    buildingTypes = [],
    fieldMapping = {}
  } = options;

  // 預設欄位對應
  const defaultMapping = {
    yearMonth: ['交易年月', '交易年月日', 'yearMonth', 'date'],
    price: ['單價元平方公尺', '單價', 'price', 'unitPrice'],
    latitude: ['緯度', 'latitude', 'lat'],
    longitude: ['經度', 'longitude', 'lng', 'lon'],
    area: ['建物移轉總面積坪', '土地移轉總面積坪', 'area'],
    address: ['交易標的', '土地位置建物門牌', 'address'],
    buildingType: ['建物型態', '建物現況格局-建物型態', 'buildingType'],
    totalPrice: ['總價元', '交易價格', 'totalPrice']
  };

  const mapping = { ...defaultMapping, ...fieldMapping };

  const processedData = [];
  let skipped = 0;

  for (const record of records) {
    try {
      // 1. 找出對應的欄位值
      const getValue = (fieldNames) => {
        for (const name of fieldNames) {
          if (record[name] !== undefined && record[name] !== null && record[name] !== '') {
            return record[name];
          }
        }
        return null;
      };

      // 2. 轉換日期
      const rawDate = getValue(mapping.yearMonth);
      let yearMonth;

      if (rawDate?.includes('年')) {
        // 民國年格式
        yearMonth = convertROCtoAD(rawDate);
      } else if (rawDate?.match(/^\d{4}-\d{2}/)) {
        // 已經是西元年格式
        yearMonth = rawDate.substring(0, 7);
      } else {
        skipped++;
        continue;
      }

      // 3. 取得或計算單價
      let unitPrice = parseFloat(getValue(mapping.price));

      if (!unitPrice) {
        const totalPrice = parseFloat(getValue(mapping.totalPrice)) || 0;
        const area = parseFloat(getValue(mapping.area)) || 0;
        if (totalPrice > 0 && area > 0) {
          unitPrice = totalPrice / area;
        }
      }

      // 4. 篩選異常值
      if (!unitPrice || unitPrice < minPrice || unitPrice > maxPrice) {
        skipped++;
        continue;
      }

      // 5. 取得經緯度
      const lat = parseFloat(getValue(mapping.latitude));
      const lng = parseFloat(getValue(mapping.longitude));

      if (!lat || !lng) {
        console.warn(`資料缺少經緯度，已跳過: ${getValue(mapping.address)}`);
        skipped++;
        continue;
      }

      // 6. 建物類型篩選
      const buildingType = getValue(mapping.buildingType);
      if (buildingTypes.length > 0 && !buildingTypes.includes(buildingType)) {
        skipped++;
        continue;
      }

      // 7. 組合資料
      processedData.push({
        position: [lng, lat],
        price: unitPrice,
        yearMonth: yearMonth,
        area: parseFloat(getValue(mapping.area)) || 0,
        address: getValue(mapping.address) || '',
        buildingType: buildingType || '',
        totalPrice: parseFloat(getValue(mapping.totalPrice)) || 0
      });

    } catch (error) {
      console.error('處理 CSV 記錄時發生錯誤:', error.message);
      skipped++;
    }
  }

  console.log(`處理完成：${processedData.length} 筆有效資料，${skipped} 筆已跳過`);
  return processedData;
}

/**
 * 處理資料庫記錄並轉換為標準格式
 */
function processDatabaseRecords(records, options = {}) {
  const {
    minPrice = 100000,
    maxPrice = 2000000,
    buildingTypes = []
  } = options;

  const processedData = [];
  let skipped = 0;

  for (const record of records) {
    try {
      // 假設資料庫已經有標準化的欄位名稱
      const unitPrice = parseFloat(record.unit_price || record.price);

      // 篩選異常值
      if (!unitPrice || unitPrice < minPrice || unitPrice > maxPrice) {
        skipped++;
        continue;
      }

      // 檢查經緯度
      const lat = parseFloat(record.latitude || record.lat);
      const lng = parseFloat(record.longitude || record.lng || record.lon);

      if (!lat || !lng) {
        skipped++;
        continue;
      }

      // 建物類型篩選
      if (buildingTypes.length > 0 && !buildingTypes.includes(record.building_type)) {
        skipped++;
        continue;
      }

      // 處理日期格式
      let yearMonth;
      if (record.year_month) {
        yearMonth = record.year_month;
      } else if (record.transaction_date) {
        const date = new Date(record.transaction_date);
        yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      processedData.push({
        position: [lng, lat],
        price: unitPrice,
        yearMonth: yearMonth,
        area: parseFloat(record.area) || 0,
        address: record.address || '',
        buildingType: record.building_type || '',
        totalPrice: parseFloat(record.total_price) || 0
      });

    } catch (error) {
      console.error('處理資料庫記錄時發生錯誤:', error.message);
      skipped++;
    }
  }

  console.log(`處理完成：${processedData.length} 筆有效資料，${skipped} 筆已跳過`);
  return processedData;
}

/**
 * 驗證並處理標準格式的資料
 */
function validateAndProcessData(data, options = {}) {
  const {
    minPrice = 100000,
    maxPrice = 2000000,
    buildingTypes = []
  } = options;

  if (!Array.isArray(data)) {
    throw new Error('資料格式錯誤：必須是陣列');
  }

  const processedData = [];
  let skipped = 0;

  for (const item of data) {
    try {
      // 驗證必要欄位
      if (!item.position || !Array.isArray(item.position) || item.position.length !== 2) {
        skipped++;
        continue;
      }

      if (!item.price || !item.yearMonth) {
        skipped++;
        continue;
      }

      // 篩選異常值
      if (item.price < minPrice || item.price > maxPrice) {
        skipped++;
        continue;
      }

      // 建物類型篩選
      if (buildingTypes.length > 0 && !buildingTypes.includes(item.buildingType)) {
        skipped++;
        continue;
      }

      processedData.push({
        position: item.position,
        price: item.price,
        yearMonth: item.yearMonth,
        area: item.area || 0,
        address: item.address || '',
        buildingType: item.buildingType || '',
        totalPrice: item.totalPrice || 0
      });

    } catch (error) {
      console.error('驗證資料時發生錯誤:', error.message);
      skipped++;
    }
  }

  console.log(`驗證完成：${processedData.length} 筆有效資料，${skipped} 筆已跳過`);
  return processedData;
}

/**
 * 儲存處理後的資料
 */
export function saveProcessedData(data, outputPath = './real-data.json') {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`資料已儲存至：${outputPath} (${data.length} 筆)`);
}

// CLI 使用範例
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 's3') {
    // 範例：從 S3 載入
    const s3Url = process.argv[3] || 'https://your-bucket.s3.region.amazonaws.com/data.json';
    loadFromS3(s3Url, { format: 'json' })
      .then(data => saveProcessedData(data))
      .catch(err => console.error(err));
  }
  else if (command === 'csv') {
    // 範例：從 CSV 載入
    const filePath = process.argv[3] || './data.csv';
    loadFromCSV(filePath, {
      minPrice: 200000,
      maxPrice: 1500000
    })
      .then(data => saveProcessedData(data))
      .catch(err => console.error(err));
  }
  else if (command === 'json') {
    // 範例：從 JSON 載入
    const filePath = process.argv[3] || './data.json';
    loadFromJSON(filePath, {
      minPrice: 200000,
      maxPrice: 1500000
    })
      .then(data => saveProcessedData(data))
      .catch(err => console.error(err));
  }
  else if (command === 'db') {
    // 範例：從資料庫載入
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'real_estate',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password'
    };

    const query = `
      SELECT
        longitude, latitude, unit_price, year_month,
        area, address, building_type, total_price
      FROM real_estate_transactions
      WHERE unit_price BETWEEN 200000 AND 1500000
      ORDER BY year_month
    `;

    loadFromDatabase(dbConfig, query, {
      minPrice: 200000,
      maxPrice: 1500000
    })
      .then(data => saveProcessedData(data))
      .catch(err => console.error(err));
  }
  else {
    console.log(`
使用方法：
  node data-loader.js s3 <s3-url>        # 從 S3 載入
  node data-loader.js csv <file-path>    # 從 CSV 載入
  node data-loader.js json <file-path>   # 從 JSON 載入
  node data-loader.js db                 # 從資料庫載入
    `);
  }
}
