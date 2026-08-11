import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WhiteboardApp from '@/components/WhiteboardApp'

export default async function AppPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <WhiteboardApp userId={user.id} userEmail={user.email || ''} />
}
