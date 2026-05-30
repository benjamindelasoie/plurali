import { CreateTree } from "@/components/CreateTree";

// Home — start a new family tree. No auth; creating a tree mints the owner link.
export default function Home() {
  return <CreateTree />;
}
