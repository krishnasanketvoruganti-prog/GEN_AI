import { ArrowRight } from "lucide-react";
import {
  BROADER_GENAI_TOPICS,
  FOUR_PILLARS,
  GAN_TOPICS,
  PARADIGM_OPTIONS,
  PIPELINE_STAGES,
} from "../data/samplesAndBenchmarks.ts";
import type { ParadigmId } from "../types/augmentation.ts";

interface GenAIParadigmsProps {
  onSelectParadigmInStudio: (paradigm: ParadigmId) => void;
}

export function GenAIParadigms({
  onSelectParadigmInStudio,
}: GenAIParadigmsProps) {
  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-8">
      {/* Section 1: Four Pillars Foundation */}
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-lg font-semibold text-slate-900">
            Automotive Damage Augmentation Architecture
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
            How DamageAugment AI combines classical computer vision, GANs,
            latent diffusion, structural conditioning, and multimodal VLMs to
            improve aftermarket collision, insurance, and fleet estimation models.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FOUR_PILLARS.map((pillar) => (
            <div
              key={pillar.index}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-2"
            >
              <div className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                {pillar.index}.
              </div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                {pillar.title}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                {pillar.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: 5-Stage Controlled GenAI Pipeline */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Controlled 5-Stage Augmentation Loop
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {PIPELINE_STAGES.map((st) => (
            <div
              key={st.stage}
              className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-1.5"
            >
              <div className="text-[11px] font-semibold text-blue-700">
                {st.stage}
              </div>
              <div className="font-display text-xs font-semibold text-slate-900">
                {st.title}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {st.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Key GAN Families & Training Challenges */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              GAN Families & Automotive Paint Challenges
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Minimax generator/discriminator paradigms for paired mask
              translation, unpaired domain adaptation, and semantic layout control.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAN_TOPICS.map((gan) => (
            <div
              key={gan.title}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-slate-500">
                  {gan.role}
                </div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  {gan.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {gan.description}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Role: </span>
                {gan.challengeMitigated}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Broader GenAI Paradigms Beyond GANs */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Broader Generative AI Paradigms Beyond GANs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Modern pipelines pair diffusion adapters, localized inpainting,
            3D-aware view synthesis, VAEs, and multimodal VLMs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BROADER_GENAI_TOPICS.map((topic) => (
            <div
              key={topic.title}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5"
            >
              <div className="text-[11px] font-medium text-blue-700">
                {topic.category}
              </div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                {topic.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {topic.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 5: Interactive Studio Paradigm Launcher Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Executable Pipeline Paradigms in Studio
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2.5 px-4 font-medium">Method</th>
                <th className="py-2.5 px-4 font-medium">Family</th>
                <th className="py-2.5 px-4 font-medium">Conditioning Signal</th>
                <th className="py-2.5 px-4 font-medium">Primary Strength</th>
                <th className="py-2.5 px-4 font-medium">Failure / Watchout</th>
                <th className="py-2.5 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PARADIGM_OPTIONS.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    {p.name}
                  </td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                    {p.family}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                    {p.conditioningSignal}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs">
                    {p.strengths}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs">
                    {p.watchouts}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectParadigmInStudio(p.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                    >
                      Open in Studio
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
