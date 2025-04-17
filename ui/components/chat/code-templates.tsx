"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  FileCode,
  Server,
  Database,
  Lock,
  LayoutGrid,
  Workflow,
  Braces,
  FileJson,
  Router,
  Terminal,
  TestTube,
  Bug,
} from "lucide-react"

interface CodeTemplatesProps {
  onSelectTemplate: (template: string) => void
}

export function CodeTemplates({ onSelectTemplate }: CodeTemplatesProps) {
  const templates = [
    {
      id: "react-component",
      name: "React Component",
      icon: <FileCode className="h-4 w-4" />,
      description: "Basic React functional component",
      code: `
      import React from 'react';

      interface Props {
        // Define your props here
      }

      const MyComponent: React.FC<Props> = ({ }) => {
        return (
          <div>
            {/* Your component JSX */}
          </div>
        );
      };

      export default MyComponent;
      `,
    },
    {
      id: "react-hook",
      name: "Custom React Hook",
      icon: <Bug className="h-4 w-4" />,
      description: "Reusable custom React Hook",
      code: `
      import { useState, useEffect } from 'react';

      function useMyCustomHook(initialValue: any) {
        const [value, setValue] = useState(initialValue);

        useEffect(() => {
          // Your hook's logic here
          console.log('Custom hook effect');
        }, [value]);

        return [value, setValue];
      }

      export default useMyCustomHook;
      `,
    },
    {
      id: "api-endpoint",
      name: "API Endpoint",
      icon: <Server className="h-4 w-4" />,
      description: "Next.js API route handler",
      code: `
      import { NextApiRequest, NextApiResponse } from 'next';

      export default async function handler(
        req: NextApiRequest,
        res: NextApiResponse
      ) {
        if (req.method === 'GET') {
          // Handle GET request
          res.status(200).json({ message: 'Success!' });
        } else if (req.method === 'POST') {
          // Handle POST request
          const data = req.body;
          // Process data
          res.status(201).json({ received: data });
        } else {
          res.setHeader('Allow', ['GET', 'POST']);
          res.status(405).end(\`Method \${req.method} Not Allowed\`);
        }
      }
      `,
    },
    {
      id: "database-model",
      name: "Database Model",
      icon: <Database className="h-4 w-4" />,
      description: "Database schema definition (e.g., Prisma)",
      code: `
      // Example Prisma Schema (schema.prisma)
      generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "postgresql"
        url      = env("DATABASE_URL")
      }

      model User {
        id        Int      @id @default(autoincrement())
        email     String   @unique
        password  String
        name      String?
        posts     Post[]
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt
      }

      model Post {
        id        Int      @id @default(autoincrement())
        title     String
        content   String?
        author    User     @relation(fields: [authorId], references: [id])
        authorId  Int
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt
      }
      `,
    },
    {
      id: "auth-middleware",
      name: "Authentication Middleware",
      icon: <Lock className="h-4 w-4" />,
      description: "Middleware for protecting routes",
      code: `
      // Example Next.js middleware for authentication
      import { NextResponse } from 'next/server';
      import type { NextRequest } from 'next/server';

      export async function middleware(request: NextRequest) {
        const token = request.cookies.get('authToken')?.value;

        if (!token) {
          return NextResponse.redirect(new URL('/login', request.url));
        }

        // In a real application, you would verify the token here

        return NextResponse.next();
      }

      export const config = {
        matcher: ['/dashboard/:path*'],
      };
      `,
    },
    {
      id: "layout-component",
      name: "Layout Component",
      icon: <LayoutGrid className="h-4 w-4" />,
      description: "Page layout component",
      code: `
      import React, { ReactNode } from 'react';
      import Navbar from './navbar';
      import Footer from './footer';

      interface LayoutProps {
        children: ReactNode;
      }

      const Layout: React.FC<LayoutProps> = ({ children }) => {
        return (
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </div>
        );
      };

      export default Layout;
      `,
    },
    {
      id: "form-validation",
      name: "Form Validation Schema",
      icon: <Workflow className="h-4 w-4" />,
      description: "Schema for form validation (e.g., Zod)",
      code: `
      import { z } from 'zod';

      export const UserFormSchema = z.object({
        name: z.string().min(2, { message: "Name must be at least 2 characters." }),
        email: z.string().email({ message: "Invalid email address." }),
        password: z.string().min(8, { message: "Password must be at least 8 characters." }),
        confirmPassword: z.string().min(8).optional(),
      }).refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
      });

      export type UserFormValues = z.infer<typeof UserFormSchema>;
      `,
    },
    {
      id: "utility-function",
      name: "Utility Function",
      icon: <Braces className="h-4 w-4" />,
      description: "Helper utility function",
      code: `
      export const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
      };

      export const capitalizeFirstLetter = (str: string): string => {
        if (!str) {
          return '';
        }
        return str.charAt(0).toUpperCase() + str.slice(1);
      };
      `,
    },
    {
      id: "typescript-interface",
      name: "TypeScript Interface",
      icon: <FileJson className="h-4 w-4" />,
      description: "Reusable TypeScript interface definition",
      code: `
      export interface Product {
        id: string;
        name: string;
        description?: string;
        price: number;
        category: string;
        imageUrl: string;
      }
      `,
    },
    {
      id: "error-handling",
      name: "Error Handling Function",
      icon: <Bug className="h-4 w-4" />,
      description: "Function for handling API errors",
      code: `
      export const handleApiError = async (response: Response) => {
        if (!response.ok) {
          const errorData = await response.json();
          console.error('API Error:', errorData);
          throw new Error(errorData.message || 'Something went wrong');
        }
        return response.json();
      };
      `,
    },
    {
      id: "nextjs-router-push",
      name: "Next.js Router Push",
      icon: <Router className="h-4 w-4" />,
      description: "Navigating between pages in Next.js",
      code: `
      import { useRouter } from 'next/router';

      const MyNavigationComponent = () => {
        const router = useRouter();

        const handleNavigate = (path: string) => {
          router.push(path);
        };

        return (
          <button onClick={() => handleNavigate('/about')}>Go to About Page</button>
        );
      };

      export default MyNavigationComponent;
      `,
    },
    {
      id: "console-log-statement",
      name: "Console Log Statement",
      icon: <Terminal className="h-4 w-4" />,
      description: "Basic console logging for debugging",
      code: `
      console.log('This is a debug message:', someVariable);
      `,
    },
    {
      id: "jest-test-case",
      name: "Jest Test Case",
      icon: <TestTube className="h-4 w-4" />,
      description: "Basic Jest unit test case",
      code: `
      describe('MyComponent', () => {
        it('should render correctly', () => {
          // Your rendering logic here
          expect(true).toBe(true); // Example assertion
        });

        it('should handle a specific action', () => {
          // Simulate an action and check the result
          expect(1 + 1).toBe(2); // Another example assertion
        });
      });
      `,
    },
  ]

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="p-4 border-b">
        <h3 className="text-sm font-semibold tracking-tight">Code Templates</h3>
      </div>
      <ScrollArea className="h-64">
        <div className="grid gap-1 p-2">
          {templates.map((template) => (
            <Button
              key={template.id}
              variant="ghost"
              className="justify-start h-auto px-3 py-2 rounded-lg hover:bg-muted"
              onClick={() => onSelectTemplate(template.code)}
            >
              <div className="flex items-start gap-3">
                {template.icon}
                <div className="text-left space-y-0.5">
                  <div className="text-sm font-medium leading-none">{template.name}</div>
                  <div className="text-xs text-muted-foreground">{template.description}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
