import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../i18n'

const SHORT_LABELS: Record<string, string> = { en: 'EN', ka: 'ქარ' }

export function LangSwitcher() {
  const { i18n, t } = useTranslation()
  const current = i18n.language === 'ka' ? 'ka' : 'en'

  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          lang={lng}
          aria-pressed={current === lng}
          aria-label={t(`lang.${lng}`)}
          onClick={() => i18n.changeLanguage(lng)}
        >
          {SHORT_LABELS[lng]}
        </button>
      ))}
    </div>
  )
}
