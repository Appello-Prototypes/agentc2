import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

const meta = {
    title: "Components/Input",
    component: Input,
    parameters: {
        layout: "centered"
    },
    tags: ["autodocs"],
    argTypes: {
        type: {
            control: "select",
            options: ["text", "email", "password", "number", "tel", "url", "search"]
        },
        disabled: {
            control: "boolean"
        },
        placeholder: {
            control: "text"
        }
    }
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        placeholder: "Enter text...",
        type: "text"
    }
};

export const WithValue: Story = {
    args: {
        defaultValue: "Hello World",
        type: "text"
    }
};

export const Email: Story = {
    args: {
        type: "email",
        placeholder: "email@example.com"
    }
};

export const Password: Story = {
    args: {
        type: "password",
        placeholder: "Enter password"
    }
};

export const Number: Story = {
    args: {
        type: "number",
        placeholder: "Enter number"
    }
};

export const Search: Story = {
    args: {
        type: "search",
        placeholder: "Search..."
    }
};

export const Disabled: Story = {
    args: {
        placeholder: "Disabled input",
        disabled: true,
        type: "text"
    }
};

export const Invalid: Story = {
    args: {
        defaultValue: "Invalid value",
        "aria-invalid": true,
        type: "text"
    }
};

export const WithFile: Story = {
    args: {
        type: "file"
    }
};

export const AllTypes: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-4">
            <Input type="text" placeholder="Text input" />
            <Input type="email" placeholder="Email input" />
            <Input type="password" placeholder="Password input" />
            <Input type="number" placeholder="Number input" />
            <Input type="tel" placeholder="Phone input" />
            <Input type="url" placeholder="URL input" />
            <Input type="search" placeholder="Search input" />
        </div>
    )
};

export const States: Story = {
    render: () => (
        <div className="flex w-[350px] flex-col gap-4">
            <Input placeholder="Default state" />
            <Input placeholder="Disabled state" disabled />
            <Input placeholder="Invalid state" aria-invalid />
            <Input defaultValue="With value" />
        </div>
    )
};
