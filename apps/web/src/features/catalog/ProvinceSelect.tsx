import { Selector } from '@astryxdesign/core/Selector';
import { useStrings } from '../../lib/i18n';

// Decision 19/2025/QD-TTg: the 34 provincial-level administrative units.
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
export function ProvinceSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useStrings();
  return (
    <div className="fr-selector-field province-field">
      <Selector
        label={t.curation.city}
        placement="below"
        options={[
          { value: '', label: t.all },
          ...provinces.map((name) => ({ value: name, label: name })),
        ]}
        value={value}
        onChange={onChange}
        hasSearch
        searchPlaceholder={t.curation.cityPlaceholder}
        emptySearchText={t.explore.noResults}
        controlClassName="fr-selector-control"
        width="100%"
      />
    </div>
  );
}
