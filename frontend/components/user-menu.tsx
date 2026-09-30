"use client"

import { LogOut } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { initials } from "@/lib/datetime"

export function UserMenu() {
  const { user, signOut } = useAuth()
  if (!user) return null

  const label = user.name ?? user.email ?? "Account"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2.5 rounded-full pl-2 pr-3.5 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Account menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="tint-violet text-xs font-semibold">
              {initials(user.name ?? user.email?.split("@")[0] ?? "?")}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[240px] truncate text-xs font-medium text-foreground">
            {user.email ?? label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{label}</p>
          {user.email && user.email !== label ? (
            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
