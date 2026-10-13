const rewardRows = [
  ['#1', '+3', '3'],
  ['#2', '+2', '2'],
  ['#3', '+2', '2'],
  ['#4', '+1', '1'],
  ['#5', '+1', '0'],
]

export function PresentationSlide({ slide }: { slide: number }) {
  if (slide === 4) {
    return (
      <article className="main-presentation__slide main-presentation__slide--four" aria-label="Slide 4: Reward Per-Challenge">
        <h1>Reward Per-Challenge</h1>
        <table className="main-presentation__rewards">
          <thead><tr><th>Peringkat</th><th>Guard Point (GP) Reward</th><th>Card Reward</th></tr></thead>
          <tbody>{rewardRows.map(([rank, points, cards]) => (
            <tr key={rank}><th scope="row">{rank}</th><td>{points}</td><td>{cards}</td></tr>
          ))}</tbody>
        </table>
        <p className="main-presentation__cap"><strong>8 kartu</strong><span>Maksimum kartu di tangan.</span></p>
        <p className="main-presentation__note">*Reward ini berlaku untuk setiap challenge</p>
        <p className="main-presentation__winner">Pemenang ditentukan berdasarkan jumlah Guard Point terbanyak</p>
        <span className="main-presentation__page-number" aria-hidden="true">4</span>
      </article>
    )
  }

  if (slide === 5) {
    return (
      <article className="main-presentation__slide main-presentation__slide--five" aria-label="Slide 5: Gigarisk Muncul">
        <img src="/ui/main-presentation/slide-05-art.png" alt="GigaRisk dragon above a fantasy battlefield" />
        <h1>Gigarisk Muncul</h1>
      </article>
    )
  }

  const image = '/ui/main-presentation/slide-' + String(slide).padStart(2, '0') + '.png'
  const labels: Record<number, string> = {
    1: 'Guard The Heart title slide',
    2: 'Goals permainan: defend the Heart of Awareness, join challenges, survive GigaRisk, and earn the most Guard Points',
    3: 'Guard Point definition, group objective, starting points and elimination warning',
    6: 'Image Decode challenge title slide',
    7: 'Image Decode gameplay instructions and scoring',
  }
  return (
    <article className="main-presentation__slide" aria-label={'Slide ' + slide}>
      <img src={image} alt={labels[slide] ?? 'Presentation slide ' + slide} />
    </article>
  )
}
