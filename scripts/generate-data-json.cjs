const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const XLSX = require('xlsx');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const municipalLayers = [
  { id: 'administrative', sheets: ['Prasasan_bhawan'], label: 'Administrative Buildings' },
  { id: 'school', sheets: ['Schools', 'school'], label: 'Schools' },
  { id: 'health', sheets: ['Health Post'], label: 'Health Post' },
  { id: 'tourism', sheets: ['Tourism_data'], label: 'Tourism Data' },
  { id: 'temple', sheets: ['Religious_Site', 'Temple'], label: 'Religious Sites' },
  { id: 'industry', sheets: ['IND'], label: 'Industry' },
  { id: 'other_government', sheets: ['Other Government Office'], label: 'Other Governmental Offices' },
  { id: 'sahakari', sheets: ['Cooperative_Sahakari', 'sahakari Data'], label: 'Co-operatives' },
];

const isBlank = value => value === undefined || value === null || String(value).trim() === '';

const toNumber = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const getFieldValue = (row, key) => {
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  const normalizedKey = key.trim().toLowerCase();
  const matchedKey = Object.keys(row).find(rowKey => rowKey.trim().toLowerCase() === normalizedKey);
  return matchedKey ? row[matchedKey] : undefined;
};

const getFirstValue = (row, keys) => {
  for (const key of keys) {
    const value = getFieldValue(row, key);
    if (!isBlank(value)) return value;
  }
  return '';
};

const getPointName = (row, fallback) => {
  const value = getFirstValue(row, [
    'Name',
    'English Name',
    'Name of School',
    'Name of Health Care Facility',
    'Name of Religious Site',
    'School Nam',
    'Name of He',
    'Name of re',
    'Name in Ne',
    'Name in Nepali',
    'Name In Nepali',
    'Nepali Name',
    'other gove',
    'namee',
    'name_I',
    'Name_N',
    'name_nep',
    'Water serv',
    'SN',
    'sn',
  ]);
  return isBlank(value) ? fallback : String(value);
};

const formatDateParts = (year, month, day) => `${month}/${day}/${year}`;

const formatExcelDate = value => {
  if (isBlank(value)) return value;

  const serial = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())
      ? Number(value.trim())
      : null;

  if (serial !== null) {
    const parsedDate = XLSX.SSF.parse_date_code(serial);
    if (parsedDate) return formatDateParts(parsedDate.y, parsedDate.m, parsedDate.d);
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const adjustedDate = new Date(value.getTime() + 6 * 60 * 60 * 1000);
    return formatDateParts(adjustedDate.getFullYear(), adjustedDate.getMonth() + 1, adjustedDate.getDate());
  }

  return value;
};

const normalizeDetails = row =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      key.trim().toLowerCase().includes('establishment date') ? formatExcelDate(value) : value,
    ])
  );

const getLayerSheet = (workbook, layer) => {
  const exactName = layer.sheets.find(name => workbook.Sheets[name]);
  if (exactName) return workbook.Sheets[exactName];

  const normalizedNames = layer.sheets.map(name => name.trim().toLowerCase());
  const matchedName = workbook.SheetNames.find(name => normalizedNames.includes(name.trim().toLowerCase()));
  return matchedName ? workbook.Sheets[matchedName] : undefined;
};

const parseMunicipalWorkbook = workbook =>
  municipalLayers.flatMap(layer => {
    const sheet = getLayerSheet(workbook, layer);
    if (!sheet) return [];

    return XLSX.utils.sheet_to_json(sheet, { defval: '' })
      .map((row, index) => {
        const lat = toNumber(getFirstValue(row, ['Latitude', 'latitude', '_location_']));
        const lng = toNumber(getFirstValue(row, ['Longitude', 'longitude', '_locatio_1']));
        if (lat === null || lng === null) return null;

        return {
          id: `${layer.id}-${index}`,
          name: getPointName(row, `${layer.label} ${index + 1}`),
          category: layer.id,
          categoryLabel: layer.label,
          lat,
          lng,
          altitude: getFirstValue(row, ['Altitude', 'altitude', '_locatio_2']),
          details: normalizeDetails(row),
          source: 'municipal',
        };
      })
      .filter(Boolean);
  });

const parseHouseCsv = csvText => {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return parsed.data
    .map((row, index) => {
      const lat = toNumber(getFirstValue(row, ['Latitude', 'latitude', '_location_']));
      const lng = toNumber(getFirstValue(row, ['Longitude', 'longitude', '_locatio_1']));
      if (lat === null || lng === null) return null;

      const sn = getFirstValue(row, ['SN', 'sn']) || index + 1;
      return {
        id: `house-${sn}-${index}`,
        name: `Household ${sn}`,
        category: 'houses',
        categoryLabel: 'House Details',
        lat,
        lng,
        altitude: getFirstValue(row, ['Altitude', 'altitude', '_locatio_2']),
        details: row,
        source: 'house',
      };
    })
    .filter(Boolean);
};

const municipalWorkbook = XLSX.readFile(path.join(publicDir, 'Municipal Data.csv'));
const houseCsv = fs.readFileSync(path.join(publicDir, 'House_Detail.csv'), 'utf8');

const municipalPoints = parseMunicipalWorkbook(municipalWorkbook);
const housePoints = parseHouseCsv(houseCsv);

fs.writeFileSync(path.join(publicDir, 'municipal-data.json'), `${JSON.stringify(municipalPoints)}\n`);
fs.writeFileSync(path.join(publicDir, 'house-data.json'), `${JSON.stringify(housePoints)}\n`);

console.log(`Wrote ${municipalPoints.length} municipal points to public/municipal-data.json`);
console.log(`Wrote ${housePoints.length} house points to public/house-data.json`);
