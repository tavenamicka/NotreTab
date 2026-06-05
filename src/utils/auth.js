import { supabase } from './supabase'

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data.user
}

export async function register(email, password, meta) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta }
  })
  if (error) throw new Error(error.message)
  if (!data.user?.identities?.length) throw new Error('Un compte avec cet email existe déjà.')
  return data.user
}

export async function logout() {
  await supabase.auth.signOut()
}

export async function updateUser(meta) {
  const { data, error } = await supabase.auth.updateUser({ data: meta })
  if (error) throw new Error(error.message)
  return data.user
}

export async function resetPassword(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw new Error(error.message)
}

export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)
  return data.user
}

