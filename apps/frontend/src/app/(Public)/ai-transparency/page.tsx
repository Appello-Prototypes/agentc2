import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "AI Transparency",
    description:
        "AgentC2 AI Transparency Statement — how we use AI models, handle data, and govern AI systems.",
    alternates: {
        canonical: "https://agentc2.ai/ai-transparency"
    }
};

const models = [
    {
        provider: "OpenAI",
        model: "GPT-4o",
        capability: "Text generation, reasoning, tool use",
        training: "No (API data not used for training)",
        retention: "30 days (abuse monitoring)"
    },
    {
        provider: "OpenAI",
        model: "text-embedding-3-small",
        capability: "Text embeddings for knowledge base search",
        training: "No",
        retention: "30 days"
    },
    {
        provider: "Anthropic",
        model: "Claude (Sonnet)",
        capability: "Text generation, reasoning, tool use",
        training: "No (API data not used for training)",
        retention: "30 days (safety monitoring)"
    },
    {
        provider: "ElevenLabs",
        model: "Various voice models",
        capability: "Text-to-speech synthesis",
        training: "No",
        retention: "Per ElevenLabs policy"
    }
];

const safeguards = [
    {
        name: "Input Guardrails",
        description:
            "Configurable content filtering rules applied to user inputs before they reach AI models, preventing injection attacks and enforcing content policies."
    },
    {
        name: "Output Guardrails",
        description:
            "Configurable content filtering rules applied to AI-generated responses, blocking harmful, inaccurate, or policy-violating content."
    },
    {
        name: "Human Approval Workflows",
        description:
            "Configurable approval gates requiring human review before agents execute high-risk actions such as sending emails, modifying records, or making API calls."
    },
    {
        name: "Tool Permissions",
        description:
            "Granular per-agent control over which external tools an agent can access, with categories including read-only, write, spend, and full access."
    },
    {
        name: "Budget Controls",
        description:
            "Spending limits enforced per agent, per organization, and per user, with hard limits that automatically halt execution when thresholds are reached."
    },
    {
        name: "Network Egress Controls",
        description:
            "Organization-level domain allowlists and denylists controlling which external services agents can communicate with."
    },
    {
        name: "Agent Evaluation",
        description:
            "Evaluation framework for measuring agent response quality, accuracy, and safety using configurable scoring criteria."
    },
    {
        name: "Feedback Collection",
        description:
            "Users can rate agent responses and provide feedback, enabling continuous improvement and issue identification."
    }
];

export default function AITransparencyPage() {
    return (
        <main className="mx-auto max-w-4xl px-6 py-16">
            <h1 className="text-foreground mb-2 text-4xl font-bold tracking-tight">
                AI Transparency Statement
            </h1>
            <p className="text-muted-foreground mb-4 text-sm">Effective Date: February 21, 2026</p>
            <p className="text-muted-foreground mb-12 text-sm">Last updated: February 21, 2026</p>

            <div className="max-w-none space-y-10">
                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        1. What AgentC2 Is
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        AgentC2 is an AI agent orchestration platform. It enables enterprise
                        customers to configure and deploy AI agents powered by third-party Large
                        Language Models (LLMs). AgentC2 does not develop, train, or host proprietary
                        AI models. All AI inference is performed by third-party providers (OpenAI
                        and Anthropic) via their APIs.
                    </p>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        2. AI Models Used
                    </h2>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                        The following AI models may be used by agents on the AgentC2 platform,
                        depending on how each agent is configured:
                    </p>
                    <div className="border-border/60 overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-border/40 border-b">
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Provider
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Model
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Capability
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Used for Training?
                                    </th>
                                    <th className="text-foreground px-5 py-3 text-left font-semibold">
                                        Provider Retention
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-border/40 divide-y">
                                {models.map((m) => (
                                    <tr key={`${m.provider}-${m.model}`}>
                                        <td className="text-foreground px-5 py-3 font-medium">
                                            {m.provider}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {m.model}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {m.capability}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {m.training}
                                        </td>
                                        <td className="text-muted-foreground px-5 py-3">
                                            {m.retention}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        3. How Your Data Is Processed
                    </h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        When you interact with an AgentC2 agent:
                    </p>
                    <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            Your input (text or voice) is sent to the configured AI model provider
                            for processing
                        </li>
                        <li>
                            The AI model generates a response, which may be supplemented by
                            information retrieved from your organization&apos;s connected data
                            sources (CRM, email, documents, etc.)
                        </li>
                        <li>
                            AgentC2 acts as a{" "}
                            <strong className="text-foreground">data processor</strong> on your
                            behalf — your organization determines what data is processed and how
                            agents are configured
                        </li>
                        <li>
                            Integration data (from CRM, email, etc.) is processed transiently and is
                            not stored by AgentC2 beyond the current interaction unless explicitly
                            saved via conversation memory
                        </li>
                        <li>
                            Document content uploaded to knowledge bases is chunked, embedded, and
                            stored in your organization&apos;s isolated vector store for retrieval
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        4. Accuracy and Limitations
                    </h2>
                    <div className="bg-muted/30 border-primary/20 rounded-xl border px-5 py-4">
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            <strong className="text-foreground">Important:</strong> AI-generated
                            responses may be inaccurate, incomplete, or outdated. AgentC2 agents
                            should not be the sole basis for decisions with legal, financial,
                            medical, or safety implications. Human review is recommended for all
                            consequential decisions.
                        </p>
                    </div>
                    <p className="text-muted-foreground mt-4 leading-relaxed">
                        AI models are inherently probabilistic and may produce outputs that are
                        plausible but factually incorrect (often called &quot;hallucinations&quot;).
                        AgentC2 provides RAG (Retrieval Augmented Generation) grounding and
                        evaluation frameworks to improve accuracy, but these do not eliminate the
                        possibility of errors.
                    </p>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        5. Safeguards and Human Oversight
                    </h2>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                        AgentC2 provides the following configurable safeguards to ensure appropriate
                        human oversight of AI agent behavior:
                    </p>
                    <div className="space-y-3">
                        {safeguards.map((s) => (
                            <div
                                key={s.name}
                                className="border-border/60 rounded-xl border px-5 py-4"
                            >
                                <h3 className="text-foreground mb-1 text-sm font-semibold">
                                    {s.name}
                                </h3>
                                <p className="text-muted-foreground text-xs leading-relaxed">
                                    {s.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        6. Bias and Fairness
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        AgentC2 relies on third-party AI models for inference. These models may
                        reflect biases present in their training data. AgentC2 addresses this
                        through configurable guardrails, evaluation frameworks, and customer
                        guidance for bias-aware agent configuration. We are developing a bias
                        testing framework to help identify and mitigate disparate impacts in agent
                        outputs, particularly for use cases involving HR, financial services, and
                        other sensitive domains.
                    </p>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        7. Data Retention
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Conversation data is stored in your organization&apos;s workspace within
                        AgentC2&apos;s database. AI model providers may retain API inputs for up to
                        30 days for abuse/safety monitoring but do not use API data for model
                        training. You may export your data at any time via the data export API. See
                        our{" "}
                        <Link href="/privacy" className="text-primary hover:underline">
                            Privacy Policy
                        </Link>{" "}
                        for full retention details.
                    </p>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        8. AI Governance Framework
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                        AgentC2&apos;s AI Governance Framework is aligned with the NIST AI Risk
                        Management Framework (AI RMF 1.0) and addresses applicable requirements
                        under the EU AI Act. Under the EU AI Act, AgentC2 is classified as a{" "}
                        <strong className="text-foreground">deployer</strong> of General Purpose AI
                        Systems (GPAIS). Primary model-provider obligations fall on OpenAI and
                        Anthropic; AgentC2 maintains deployer obligations including deployment
                        logging, human oversight mechanisms, and transparency.
                    </p>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">
                        9. Prohibited Uses
                    </h2>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                        AgentC2 customers must not use the platform to:
                    </p>
                    <ul className="text-muted-foreground ml-5 list-disc space-y-2 text-sm leading-relaxed">
                        <li>
                            Generate content that promotes violence, discrimination, or illegal
                            activity
                        </li>
                        <li>Impersonate individuals or organizations without authorization</li>
                        <li>
                            Make automated decisions with legal or significant effects without human
                            oversight
                        </li>
                        <li>
                            Use voice capabilities to create non-consensual deepfakes or
                            impersonations
                        </li>
                        <li>
                            Process special category data (health, biometric, genetic) without
                            appropriate safeguards
                        </li>
                        <li>
                            Circumvent guardrail protections outside of authorized security testing
                        </li>
                    </ul>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        See our{" "}
                        <Link href="/terms" className="text-primary hover:underline">
                            Terms of Service
                        </Link>{" "}
                        for the complete acceptable use policy.
                    </p>
                </section>

                <section>
                    <h2 className="text-foreground mb-3 text-2xl font-semibold">10. Contact</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        For questions about AI governance, data processing, or to exercise data
                        rights, contact{" "}
                        <a
                            href="mailto:privacy@agentc2.ai"
                            className="text-primary hover:underline"
                        >
                            privacy@agentc2.ai
                        </a>
                        .
                    </p>
                </section>
            </div>
        </main>
    );
}
