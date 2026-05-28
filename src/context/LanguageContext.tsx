'use client'

/**
 * Language context — provides a 4-language toggle (ko/en/ja/zh) to all
 * client components under the admin layout. Server components remain Korean.
 *
 * Usage:
 *   const { lang, setLang, t } = useLanguage()
 *   <span>{t.nav_dashboard}</span>
 */

import { createContext, useContext, useState } from 'react'
import type { Language, I18nDict } from '@/lib/i18n'
import { DICT } from '@/lib/i18n'

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: I18nDict
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ko',
  setLang: () => {},
  t: DICT.ko,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('ko')
  return (
    <LanguageContext.Provider value={{ lang, setLang, t: DICT[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  return useContext(LanguageContext)
}
