/** English presentation for legacy saved text; ids, names and source assets stay stable. */
const TEXT: Record<string, string> = {
  'Nasabah':'Customer', 'Dokumen':'Document', 'Dana':'Funds', 'Kepercayaan':'Trust', 'Peraturan':'Rules', 'Akun':'Account', 'Informasi':'Information', 'Prinsip':'Principle',
  'Rekening':'Account', 'Selisih Kas':'Cash Difference', 'Amanah':'Trust', 'Regulasi':'Regulation', 'Tunggakan':'Arrears', 'Siber':'Cyber', 'Data Pribadi':'Personal Data', 'Syariah':'Sharia', 'Lapor':'Report', '1 Kata':'1 Word', '2 Kata':'2 Words',
  'Menambah +2 Guard Point (GP).':'Adds +2 Guard Power (GP).', 'Menambah +3 Guard Point (GP).':'Adds +3 Guard Power (GP).',
  'Melindungi 1 Guard Point (GP) dari serangan Gigarisk.':'Blocks 1 GP of damage from a GigaRisk attack.',
  'Ambil 1 Guard Point (GP) dari satu tim lawan.':'Steal 1 GP from one opponent.', 'Ambil 2 Guard Point (GP) dari satu tim lawan.':'Steal 2 GP from one opponent.',
  'Ambil 1 Guard Point (GP) dari setiap tim lawan.':'Steal 1 GP from every opponent.',
  'Pemilik kartu dan tim target tidak kehilangan Guard Point (GP) dari satu kali serangan Gigarisk.':'Protect the owner and target team from one GigaRisk attack.',
  'Menelan efek serangan GigaRisk dan mengubahnya menjadi +4 Guard Point (GP).':'Absorb the GigaRisk attack and turn it into +4 GP.',
  'Ambil 2 Guard Point (GP) dari 1 atau 2 tim lawan saat Card Reveal.':'Steal 2 GP from one or two opponents during Card Reveal.',
  'Semua team terlindungi dari serangan Gigarisk dan masing-masing +1 Guard Point (GP).':'Protect every team from GigaRisk and grant each team +1 GP.',
  '(Passive Skill) Otomatis bangkit dengan penambahan +1 Guard Point (GP) saat Guard Point (GP) mencapai 0.':'Passive: revive once with +1 GP when GP reaches 0.',
  'Pilih 1 kartu: Challenge 1–2 dari 3 kartu (2 Normal, 1 Rare); Challenge 3 dari 4 kartu (2 Normal, 1 Rare, 1 Epic). Batas rank tetap berlaku.':'Choose 1 card: Challenges 1–2 offer 2 Normal and 1 Rare; Challenge 3 offers 2 Normal, 1 Rare and 1 Epic. Rank restrictions apply.',
  'Challenge ini sudah diserang GigaRisk.':'This challenge has already received a GigaRisk attack.',
  'Serangan GigaRisk selesai; pilihan kartu sudah dikunci.':'The GigaRisk attack is complete; card choices are locked.',
  'Card Reveal sudah diterapkan; pilihan kartu dikunci.':'Card Reveal is complete; card choices are locked.',
  'Second Chance aktif otomatis; tidak dapat dipilih pada Tactical Phase.':'Second Chance triggers automatically and cannot be selected in Tactical Phase.',
  'Fortune Draw: pilih 1 kartu dari tawaran sebelum serangan.':'Fortune Draw: choose 1 offered card before attacking.',
  'Fortune Draw: tidak ada efek berbeda yang tersedia dan belum dimiliki tim ini.':'Fortune Draw: no distinct, unowned effects are available.',
  'Fortune Draw sudah dipakai pada challenge lain; pilihan tidak dapat diubah.':'Fortune Draw was used in another challenge; its choice is locked.',
  'Kartu Fortune Draw telah berubah. Muat ulang sebelum mengubah pilihan.':'The Fortune Draw card changed. Reload before changing your choice.',
  'Fortune Draw sudah digunakan atau bukan milik tim ini.':'Fortune Draw has been used or is not owned by this team.',
  'Fortune Draw: pilih 1 kartu dari tawaran.':'Fortune Draw: choose 1 offered card.',
  'Fortune Draw: perlu kartu dengan efek berbeda.':'Fortune Draw requires cards with distinct effects.',
  'Kartu pilihan Fortune Draw tidak tersedia. Muat ulang sebelum melanjutkan.':'The chosen Fortune Draw card is unavailable. Reload before continuing.',
  'Kartu pilihan Fortune Draw tidak tersedia. Pilih kartu Rare lain dari tawaran yang tersimpan.':'The chosen Fortune Draw card is unavailable. Choose another Rare card from the saved offer.',
  'Tim sudah memiliki desain kartu pilihan Fortune Draw.':'This team already owns the chosen Fortune Draw design.',
  'Koleksi tim penuh; tidak dapat menerima Fortune Draw.':'The team inventory is full; Fortune Draw cannot be received.',
  'Rank 5: perlu dua desain Normal berbeda yang belum dimiliki tim.':'Rank 5 requires two distinct, unowned Normal designs.',
  'Tawaran rank 5 tidak tersedia.':'The rank 5 offer is unavailable.', 'Kartu sudah dipilih. Pilihan tidak dapat diulang.':'A card has already been chosen. The choice is final.',
  'Pilih salah satu kartu tertutup.':'Choose one closed card.', 'Kartu tidak tersedia.':'The card is unavailable.',
  'Rank 5 hanya dapat menerima 1 kartu Normal atau False Hope.':'Rank 5 can receive one Normal card or False Hope.',
  'Rank 5 sudah menerima hasil untuk challenge ini.':'Rank 5 has already received this challenge reward.',
  'Koleksi penuh atau desain kartu sudah dimiliki.':'The inventory is full or this design is already owned.',
  'Tim tidak ditemukan':'Team not found',
  'Rank 5 hanya dapat menerima kartu Normal atau False Hope.':'Rank 5 can only receive Normal cards or False Hope.',
  'Rank 5 hanya dapat menerima 1 kartu Normal per challenge.':'Rank 5 can receive only one Normal card per challenge.',
  'Selesaikan challenge terlebih dahulu atau isi Tactical Phase dengan kartu yang dipilih.':'Complete the challenge first or choose cards in Tactical Phase.',
};
export function englishText(value: string): string {
  if (TEXT[value]) return TEXT[value]
  return value.replace(/^Pilih tim( target| lawan) untuk /, 'Choose a team for ').replace(/ \(dua tim yang berbeda\)/g, ' (two different teams)')
    .replace(/Dicuri dari /g, 'Stolen from ').replace(/Dicuri oleh /g, 'Stolen by ').replace(/Reverse oleh /g, 'Reverse by ')
    .replace(/Perubahan hadiah GP:/g, 'GP reward adjustment:').replace(/Rekalkulasi hadiah GP challenge/g, 'Challenge GP reward recalculation')
    .replace(/Saldo awal tim/g, 'Team opening balance').replace(/Saldo awal dari data sebelumnya/g, 'Imported opening balance')
    .replace(/Kartu menunggu serangan GigaRisk/g, 'Cards awaiting GigaRisk attack').replace(/Serangan GigaRisk/g, 'GigaRisk attack')
}
