/**
 * 房地產資料處理工具
 * 用於將實價登錄 CSV 資料轉換為視覺化所需格式
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';

/**
 * 民國年轉西元年
 * @param {string} rocDate - 民國年格式：'112年01月' 或 '11201'
 * @returns {string} - 西元年格式：'2023-01'
 */
function convertROCtoAD(rocDate) {
  // 處理 "112年01月" 格式
  const match1 = rocDate.match(/(\d+)年(\d+)月/);
  if (match1) {
    const year = parseInt(match1[1]) + 1911;
    const month = match1[2].padStart(2, '0');
    return `${year}-${month}`;
  }

  // 處理 "11201" 格式
  const match2 = rocDate.match(/(\d{3})(\d{2})/);
  if (match2) {
    const year = parseInt(match2[1]) + 1911;
    const month = match2[2];
    return `${year}-${month}`;
  }

  return null;
}

/**
 * 簡易地址轉經緯度（需要外部 API）
 * 這裡提供範例，實際使用時需要串接 Google Maps API 或其他服務
 */
async function geocodeAddress(address) {
  // TODO: 實際使用時需要串接地理編碼 API
  // 例如：Google Maps Geocoding API, TW Address API 等

  // 範例：使用 Google Maps API
  // const apiKey = 'YOUR_GOOGLE_MAPS_API_KEY';
  // const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  // const response = await fetch(url);
  // const data = await response.json();
  // if (data.results && data.results[0]) {
  //   return {
  //     lat: data.results[0].geometry.location.lat,
  //     lng: data.results[0].geometry.location.lng
  //   };
  // }

  // 臨時方案：使用台北市中心隨機分布（僅供測試）
  return {
    lat: 25.0330 + (Math.random() - 0.5) * 0.1,
    lng: 121.5654 + (Math.random() - 0.5) * 0.1
  };
}

/**
 * 處理實價登錄 CSV 資料
 * @param {string} csvFilePath - CSV 檔案路徑
 * @param {object} options - 處理選項
 */
async function processRealEstateData(csvFilePath, options = {}) {
  const {
    minPrice = 100000,      // 最低單價（元/坪）
    maxPrice = 2000000,     // 最高單價（元/坪）
    buildingTypes = [],     // 建物類型篩選（空陣列 = 全部）
    outputPath = './processed-data.json'
  } = options;

  // 讀取 CSV 檔案
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true  // 處理 BOM (Byte Order Mark)
  });

  console.log(`讀取到 ${records.length} 筆原始資料`);

  const processedData = [];
  let skipped = 0;

  for (const record of records) {
    try {
      // 1. 轉換日期
      const yearMonth = convertROCtoAD(record['交易年月'] || record['交易年月日']);
      if (!yearMonth) {
        skipped++;
        continue;
      }

      // 2. 計算單價（如果沒有單價欄位）
      let unitPrice = parseFloat(record['單價元平方公尺']) || parseFloat(record['單價']);

      // 如果沒有單價，用總價 / 坪數計算
      if (!unitPrice) {
        const totalPrice = parseFloat(record['總價元'] || record['交易價格']) || 0;
        const area = parseFloat(record['建物移轉總面積坪'] || record['土地移轉總面積坪']) || 0;
        if (totalPrice > 0 && area > 0) {
          unitPrice = totalPrice / area;
        }
      }

      // 3. 篩選異常值
      if (!unitPrice || unitPrice < minPrice || unitPrice > maxPrice) {
        skipped++;
        continue;
      }

      // 4. 建物類型篩選
      const buildingType = record['建物型態'] || record['建物現況格局-建物型態'];
      if (buildingTypes.length > 0 && !buildingTypes.includes(buildingType)) {
        skipped++;
        continue;
      }

      // 5. 取得地址（實價登錄會做去識別化）
      const address = [
        record['縣市'],
        record['鄉鎮市區'],
        record['交易標的'] || record['土地位置建物門牌']
      ].filter(Boolean).join('');

      // 6. 地理編碼（實際使用時需要 API）
      let coords;
      if (record['緯度'] && record['經度']) {
        coords = {
          lat: parseFloat(record['緯度']),
          lng: parseFloat(record['經度'])
        };
      } else {
        // 如果沒有經緯度，需要使用地理編碼
        coords = await geocodeAddress(address);
      }

      // 7. 組合資料
      processedData.push({
        position: [coords.lng, coords.lat],
        price: unitPrice,
        yearMonth: yearMonth,
        area: parseFloat(record['建物移轉總面積坪']) || 0,
        address: address,
        buildingType: buildingType,
        totalPrice: parseFloat(record['總價元']) || 0
      });

    } catch (error) {
      console.error(`處理資料時發生錯誤:`, error.message);
      skipped++;
    }
  }

  console.log(`處理完成：${processedData.length} 筆有效資料，${skipped} 筆已跳過`);

  // 儲存處理後的資料
  fs.writeFileSync(outputPath, JSON.stringify(processedData, null, 2), 'utf-8');
  console.log(`資料已儲存至：${outputPath}`);

  return processedData;
}

/**
 * 範例：產生台北市範例資料（供測試用）
 */
function generateTaipeiSampleData() {
  const data = [];
  const startDate = new Date('2023-01-01');
  const endDate = new Date('2024-12-01');

  // 台北市各區中心點
  const districts = [
    { name: '大安區', lat: 25.0267, lng: 121.5435 },
    { name: '信義區', lat: 25.0330, lng: 121.5654 },
    { name: '中正區', lat: 25.0329, lng: 121.5177 },
    { name: '松山區', lat: 25.0490, lng: 121.5788 },
    { name: '中山區', lat: 25.0636, lng: 121.5260 },
  ];

  for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    districts.forEach(district => {
      const numTransactions = Math.floor(Math.random() * 50) + 30;

      for (let i = 0; i < numTransactions; i++) {
        const lat = district.lat + (Math.random() - 0.5) * 0.02;
        const lng = district.lng + (Math.random() - 0.5) * 0.02;

        const basePrice = district.name === '大安區' ? 800000 :
                         district.name === '信義區' ? 750000 : 600000;
        const price = basePrice + (Math.random() - 0.5) * 300000;

        data.push({
          position: [lng, lat],
          price: Math.max(300000, price),
          yearMonth: yearMonth,
          area: 20 + Math.random() * 30,
          address: `台北市${district.name}`,
          buildingType: '住宅大樓(11層含以上有電梯)',
          totalPrice: 0
        });
      }
    });
  }

  fs.writeFileSync('./sample-data.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log(`範例資料已產生：./sample-data.json (${data.length} 筆)`);
  return data;
}

// 如果直接執行此檔案
if (import.meta.url === `file://${process.argv[1]}`) {
  // 產生範例資料
  generateTaipeiSampleData();

  // 或者處理實際的 CSV 檔案（取消註解使用）
  // processRealEstateData('./your-data.csv', {
  //   minPrice: 200000,
  //   maxPrice: 1500000,
  //   buildingTypes: ['住宅大樓(11層含以上有電梯)', '華廈(10層含以下有電梯)'],
  //   outputPath: './processed-data.json'
  // });
}

export { processRealEstateData, convertROCtoAD, generateTaipeiSampleData };
