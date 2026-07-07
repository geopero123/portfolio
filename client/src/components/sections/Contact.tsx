import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { site } from '../../data/site'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import './sections.css'

type Status = 'idle' | 'sending' | 'success' | 'error' | 'invalid'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Contact() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>('idle')
  const reveal = useScrollReveal<HTMLDivElement>()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const message = String(data.get('message') ?? '').trim()
    const company = String(data.get('company') ?? '') // honeypot

    if (!name || !message || !EMAIL_PATTERN.test(email)) {
      setStatus('invalid')
      return
    }

    setStatus('sending')
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, company }),
      })
      if (!response.ok) throw new Error(`contact endpoint returned ${response.status}`)
      setStatus('success')
      form.reset()
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="section" id="contact" aria-labelledby="contact-title">
      <div className="wrap contact-grid reveal-3d" ref={reveal}>
        <div className="section-head">
          <p className="eyebrow">{t('contact.eyebrow')}</p>
          <h2 id="contact-title">{t('contact.title')}</h2>
          <p className="sub">{t('contact.sub')}</p>
          <p className="contact-direct">
            {t('contact.direct')} <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
        </div>

        <form className="contact-form" onSubmit={onSubmit} noValidate>
          <div className="form-row">
            <div className="field">
              <label htmlFor="contact-name">{t('contact.name')}</label>
              <input id="contact-name" name="name" type="text" autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="contact-email">{t('contact.email')}</label>
              <input id="contact-email" name="email" type="email" autoComplete="email" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="contact-message">{t('contact.message')}</label>
            <textarea id="contact-message" name="message" rows={6} required />
          </div>
          {/* honeypot — hidden from real users, tempting for bots */}
          <div className="hp-field" aria-hidden="true">
            <label>
              Company
              <input name="company" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div className="form-foot">
            <button className="btn primary" type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? t('contact.sending') : t('contact.send')}
            </button>
            <p className={`form-status ${status}`} role="status">
              {status === 'success' && t('contact.success')}
              {status === 'error' && t('contact.error')}
              {status === 'invalid' && t('contact.invalid')}
            </p>
          </div>
        </form>
      </div>
    </section>
  )
}
