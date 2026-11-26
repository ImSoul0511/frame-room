// Previous province names remain valid for profiles created before the 2025 merger.
const merged: Record<string, string[]> = {
  'Tuyên Quang': ['Hà Giang'],
  'Lào Cai': ['Yên Bái'],
  'Thái Nguyên': ['Bắc Kạn'],
  'Phú Thọ': ['Vĩnh Phúc', 'Hòa Bình'],
  'Bắc Ninh': ['Bắc Giang'],
  'Hưng Yên': ['Thái Bình'],
  'Hải Phòng': ['Hải Dương'],
  'Ninh Bình': ['Hà Nam', 'Nam Định'],
  'Quảng Trị': ['Quảng Bình'],
  'Đà Nẵng': ['Quảng Nam', 'Da Nang'],
  'Quảng Ngãi': ['Kon Tum'],
  'Gia Lai': ['Bình Định'],
  'Khánh Hòa': ['Ninh Thuận'],
  'Lâm Đồng': ['Đắk Nông', 'Bình Thuận'],
  'Đắk Lắk': ['Phú Yên'],
  'Hồ Chí Minh': [
    'Thành phố Hồ Chí Minh',
    'TP Hồ Chí Minh',
    'Ho Chi Minh City',
    'Bình Dương',
    'Bà Rịa - Vũng Tàu',
  ],
  'Đồng Nai': ['Bình Phước'],
  'Tây Ninh': ['Long An'],
  'Cần Thơ': ['Sóc Trăng', 'Hậu Giang', 'Can Tho'],
  'Vĩnh Long': ['Bến Tre', 'Trà Vinh'],
  'Đồng Tháp': ['Tiền Giang'],
  'Cà Mau': ['Bạc Liêu'],
  'An Giang': ['Kiên Giang'],
  'Hà Nội': ['Hanoi'],
  Huế: ['Thừa Thiên Huế'],
};

const provinces = [
  'An Giang',
  'Bắc Ninh',
  'Cà Mau',
  'Cao Bằng',
  'Cần Thơ',
  'Đà Nẵng',
  'Đắk Lắk',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Nội',
  'Hà Tĩnh',
  'Hải Phòng',
  'Hồ Chí Minh',
  'Huế',
  'Hưng Yên',
  'Khánh Hòa',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Nghệ An',
  'Ninh Bình',
  'Phú Thọ',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sơn La',
  'Tây Ninh',
  'Thái Nguyên',
  'Thanh Hóa',
  'Tuyên Quang',
  'Vĩnh Long',
];

export function normalizeLocation(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const vietnamLocalities = provinces.map((name) => ({
  id: normalizeLocation(name).replace(/ /g, '-'),
  name,
  english:
    name === 'Hà Nội'
      ? 'Hanoi'
      : name === 'Hồ Chí Minh'
        ? 'Ho Chi Minh City'
        : name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/Đ/g, 'D')
            .replace(/đ/g, 'd'),
  aliases: [
    ...(merged[name] ?? []),
    ...(name === 'Hồ Chí Minh' ? ['HCMC', 'Saigon', 'Sài Gòn'] : []),
  ],
}));

export function findVietnamLocality(value: string) {
  const key = normalizeLocation(value).replace(/^(thanh pho|tinh) /, '');
  return vietnamLocalities.find(({ name, id, english, aliases }) =>
    [name, id, english, ...aliases].some((alias) => normalizeLocation(alias) === key),
  );
}
