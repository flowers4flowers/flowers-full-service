// next/app/about/page.js

import Image from "next/image";

export default function About() {
  return (
    <div className="pt-32 lg:pt-16 pb-16">
      <h1 className="font-primary text-2xl font-bold lg:text-xxl leading-[1.2] mb-10 lg:mb-16">
        We use image, story, and perspective to help ideas take shape in the
        world, creating work that forms culture through creative vision.
      </h1>

      <div className="grid grid-cols-12 gap-8 items-center">
        <div className="col-span-12 lg:col-span-5 lg:w-[467px] space-y-6 font-secondary font-normal text-[15px] leading-[19.5px] lg:text-[18px] lg:leading-[23.4px]">
          <p>
            At the root of FLOWERS is storytelling. We create projects that give
            brands the power to communicate exactly who they are. We make art
            that brings their people, ideas, and character fully to life.
          </p>

          <p>
            We are here to create and innovate, not just execute a brief. By
            joining the process early, we can help define the idea, establish
            the art direction, and build a visual world that moves the brand
            forward
          </p>

          <p>
            When we collaborate across strategy, art direction, production, and
            final delivery, we can create work that gives your brand a more
            distinct place in the world.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="relative w-full lg:ml-auto">
            <Image
              src="/about/1.png"
              alt="FLOWERS studio"
              width={585}
              height={387}
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        </div>
      </div>

      <hr className="border-t border-black dark:border-cream my-32" />

      <div className="grid grid-cols-12 gap-8 items-center">
        <div className="col-span-12 lg:col-span-5">
          <div className="relative w-full">
            <Image
              src="/about/2.png"
              alt="Cait Oppermann"
              width={467}
              height={600}
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 font-secondary font-normal text-[15px] leading-[19.5px] lg:text-[18px] lg:leading-[23.4px]">
          <h2 className="font-primary font-bold text-[22px] leading-[100%] tracking-[-0.01em] lg:text-[30px] mb-1">
            Cait Oppermann
          </h2>
          <p className="mb-6">Founder &amp; Creative Director</p>

          <div className="space-y-6">
            <p>
              After 10+ years working across editorial and commercial
              photography, Cait founded FLOWERS to bring both ways of making
              into one studio. Her work for <em>The New York Times Magazine</em>{" "}
              and other publications sharpened an instinct for observation,
              human detail, and finding the story already present in a subject.
              That same perspective now guides ambitious work for brands
              including IBM, Rapha, and Stella Artois.
            </p>

            <p>
              Cait approaches every project with genuine curiosity and a belief
              that the strongest images have to be earned. FLOWERS grew from
              that approach: a studio where strategy, art direction, production,
              and image-making stay connected, and where long-term collaboration
              creates work with greater depth.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-40 pb-20"></div>

      <div >
        <h2 className="font-primary font-bold text-[32px] leading-[100%] tracking-[-0.03em] lg:text-[48px] mb-10 lg:mb-16">
          What we do
        </h2>

        <div className="border-t border-black dark:border-cream">
          {[
            {
              title: "Art Direction",
              description:
                "We turn an inital concept into a clear visual direction. Through research and exploration, we define the tone, references, style, and details that give the project its character and allows us to execute with a clear vision.",
            },
            {
              title: "Strategy",
              description:
                "Strategy begins with questions. What is true about the project? What does it need to communicate? Who should it matter to? We use those answers to find the idea at the center of the work and decide what deserves attention.",
            },
            {
              title: "Photography",
              description:
                "Photography is where we bring ideas into the world. The images grow from the strategy and art direction while leaving room for the people, places, and unexpected moments that give the work life.",
            },
            {
              title: "Production",
              description:
                "We build the team and structure needed to bring the idea to life. We'll create the best set you've ever stepped foot on. At the same time, we manage budgets, schedules, casting, locations, and crew without losing sight of the original idea.",
            },
            {
              title: "Visual Identity",
              description:
                "We develop the visual language that gives brands continuity beyond a single project. We bring Image, type, color, and graphic elements together to create art that shapes the brand.",
            },
            {
              title: "Partnership",
              description:
                "The longer we work with a brand, the more instinctive the creative process becomes. That shared history gives us the freedom to think beyond a single campaign and create work that shapes how the brand is seen over time.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="grid grid-cols-12 gap-8 py-10 border-b border-black dark:border-cream"
            >
              <h3 className="col-span-12 lg:col-span-5 font-primary font-bold text-[22px] leading-[100%] tracking-[-0.01em] lg:text-[30px]">
                {item.title}
              </h3>

              <p className="col-span-12 lg:col-span-6 font-secondary font-normal text-[15px] leading-[19.5px] lg:text-[18px] lg:leading-[23.4px]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
