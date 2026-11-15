import { Pills, Text, Toggle } from './ui.jsx'

const ENCRYPTIONS = [
  { value: 'WPA', label: 'WPA/WPA2/WPA3' },
  { value: 'WEP', label: 'WEP' },
  { value: 'nopass', label: 'Open' },
]

export default function ContentForm({ type, values, onChange }) {
  const set = (patch) => onChange({ ...values, ...patch })

  if (type === 'url') {
    return (
      <Text
        id="f-url"
        label="Destination"
        value={values.url}
        onChange={(url) => set({ url })}
        placeholder="example.com/pricing"
        inputMode="url"
        autoComplete="url"
      />
    )
  }

  if (type === 'text') {
    return (
      <Text
        id="f-text"
        label="Text"
        hint={`${new TextEncoder().encode(values.text || '').length} bytes`}
        value={values.text}
        onChange={(text) => set({ text })}
        placeholder="Anything you want the scan to show"
        multiline
      />
    )
  }

  if (type === 'wifi') {
    return (
      <>
        <Text
          id="f-ssid"
          label="Network name (SSID)"
          value={values.ssid}
          onChange={(ssid) => set({ ssid })}
          placeholder="Cafe Guest"
        />
        <div>
          <p className="eyebrow mb-1.5">Security</p>
          <Pills
            name="Wi-Fi security"
            size="sm"
            options={ENCRYPTIONS}
            value={values.encryption}
            onChange={(encryption) => set({ encryption })}
          />
        </div>
        {values.encryption !== 'nopass' && (
          <Text
            id="f-wifipass"
            label="Password"
            value={values.password}
            onChange={(password) => set({ password })}
            placeholder="••••••••"
            autoComplete="off"
          />
        )}
        <Toggle
          label="Hidden network"
          description="Tick this only if the network does not broadcast its name."
          checked={values.hidden}
          onChange={(hidden) => set({ hidden })}
        />
      </>
    )
  }

  if (type === 'vcard') {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text id="f-first" label="First name" value={values.firstName} onChange={(firstName) => set({ firstName })} placeholder="Ada" />
          <Text id="f-last" label="Last name" value={values.lastName} onChange={(lastName) => set({ lastName })} placeholder="Lovelace" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text id="f-org" label="Organisation" value={values.org} onChange={(org) => set({ org })} placeholder="Analytical Engines" />
          <Text id="f-title" label="Job title" value={values.title} onChange={(title) => set({ title })} placeholder="Mathematician" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text id="f-phone" label="Phone" value={values.phone} onChange={(phone) => set({ phone })} placeholder="+44 20 7946 0000" inputMode="tel" />
          <Text id="f-email" label="Email" value={values.email} onChange={(email) => set({ email })} placeholder="ada@example.com" inputMode="email" />
        </div>
        <Text id="f-vurl" label="Website" value={values.url} onChange={(url) => set({ url })} placeholder="example.com" inputMode="url" />
        <Text id="f-addr" label="Address" value={values.address} onChange={(address) => set({ address })} placeholder="12 Bishopsgate, London" multiline />
        <Text id="f-note" label="Note" value={values.note} onChange={(note) => set({ note })} placeholder="Optional" />
      </>
    )
  }

  if (type === 'email') {
    return (
      <>
        <Text id="f-to" label="To" value={values.to} onChange={(to) => set({ to })} placeholder="hello@example.com" inputMode="email" />
        <Text id="f-subj" label="Subject" value={values.subject} onChange={(subject) => set({ subject })} placeholder="Optional" />
        <Text id="f-body" label="Message" value={values.body} onChange={(body) => set({ body })} placeholder="Optional" multiline />
      </>
    )
  }

  return (
    <>
      <Text id="f-num" label="Number" value={values.number} onChange={(number) => set({ number })} placeholder="+44 7700 900000" inputMode="tel" />
      <Text id="f-msg" label="Message" value={values.message} onChange={(message) => set({ message })} placeholder="Optional" multiline />
    </>
  )
}
