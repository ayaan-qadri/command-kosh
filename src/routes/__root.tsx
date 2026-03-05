import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { TamperedCommandInfo } from '../types'

function RootLayout() {
    const navigate = useNavigate()

    useEffect(() => {
        // Pull-based: check tampering state on mount (primary source of truth)
        invoke<TamperedCommandInfo[]>('get_tampering_state')
            .then((state) => {
                if (state && state.length > 0) {
                    navigate({ to: '/tampering-review' })
                }
            })
            .catch(() => {
                // Ignore errors — app may not be ready yet
            })

        // Push-based: listen for tampering event as secondary notification
        const unlisten = listen('tampering-detected', () => {
            navigate({ to: '/tampering-review' })
        })

        return () => {
            unlisten.then((fn) => fn())
        }
    }, [navigate])

    return (
        <>
            <Outlet />
        </>
    )
}

export const Route = createRootRoute({
    component: RootLayout,
})
