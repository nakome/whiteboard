import SharedWhiteboard from '@/components/SharedWhiteboard'

type Props = {
  params: Promise<{ token: string }>
}

export default async function SharePage({ params }: Props) {
  const { token } = await params
  const safeToken = decodeURIComponent(token || '').trim()

  if (!safeToken) {
    return (
      <div className="wb-share-error">
        <h1>Enlace no válido</h1>
        <p>Falta el token de compartición.</p>
      </div>
    )
  }

  return <SharedWhiteboard token={safeToken} />
}
