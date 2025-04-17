import { TestToast } from "@/components/test-toast"

export default function TestPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Toast Test Page</h1>
      <p className="mb-4">Click the buttons below to test different toast notifications</p>
      <TestToast />
    </div>
  )
}
