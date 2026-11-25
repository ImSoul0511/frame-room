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

export function provinceNames(city: string): string[] {
  const key = Object.keys(merged).find(
    (name) => name.toLocaleLowerCase('vi') === city.toLocaleLowerCase('vi'),
  );
  return key ? [key, ...merged[key]] : [city];
}
