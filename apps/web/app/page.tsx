import { TaskComposer } from "./_components/TaskComposer";
import { ProductBuilder } from "./_components/ProductBuilder";

export default function Home() {
  return (
    <div>
      <h1>Autonomous Work Platform</h1>
      <p>Give the system a goal. It plans, acts, verifies, and delivers. (Fetch-only research — no browser/computer control.)</p>
      <TaskComposer />
      <ProductBuilder />
    </div>
  );
}
