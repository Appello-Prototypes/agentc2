```tex
It's always something when you're adulting, whether it is. Yeah. Yes, it is. Oh my goodness.
0:08
Just adding to the technical difficulties. Uh I just got a phone call and it took over my AirPods for a
0:13
second. Okay, I think we're live and welcome everyone to this live stream on building
0:20
aic workflows with Master. I'm so stoked you could join us live here on Zoom.
0:25
Here on Zoom, you can participate in the chat. You can ask questions and things like that. If maybe you're tuning in
0:30
over on YouTube or on X or something like that, we won't be monitoring those
0:36
conversations actively, but you can definitely still join the Zoom by following the link to the Luma which
0:42
which is on the master homepage right now.
0:52
Okay, so workflows and workflows with master we're going to run for the next
0:58
40 minutes since we lost 5 minutes to technical difficulties and we're going to tell you more about what a workflow
1:05
is and how it's different from an agent. These are two different approaches to building aic systems and they get
1:11
conflated sometimes. I think we can bring some clarity to that today through our description, but we're also going to
1:16
be looking at lots of code examples as well. We're using a little TL draw here to give you an overview. No slides.
1:23
We're going to get into the workshop and the examples so you can learn by example rather than just focusing on theory, but
1:29
we will start here. You're going to learn how to build your first master workflow. We're going to look at some pre-written code and Tony's going to
1:36
walk you through each of the constructs and how they come together. As the workshop progresses, we'll look at some
1:42
more intermediate type orchestration functions to do with branching, mapping, looping, and so on. We'll also, I think,
1:49
have a little peek at some human in the loop stuff. Is that right, Tony?
1:54
That's right. The best thing about coming to a workshop like this as opposed to
2:01
watching a YouTube video or something like that is that it's interactive. Um, if you have questions or comments, if
2:07
there's something you want to get from this workshop, please use this opportunity to ask Tony your questions.
2:13
I'll chime in where I can as well. I'll monitor the chat the best I can, but the best way to make sure your question gets
2:19
answered is by using the Q&A tab that presents it to us as hosts in a very tidy format where we can work through it
2:25
methodically and make sure we get the question if it's relevant to the workshop. You might be wondering who we
2:31
are and why we're here on screen. Well, I'm joined by Tony. Tony is a founding engineer at Mastra, previously at
2:37
Versell and Nex.js as well as some other cool companies. And Tony, as I understand it, when I joined Mastra and
2:44
I had a bunch of questions about workflows, you were the person I went to I went to because you are one of the
2:49
brains uh behind the feature. And so I'm really excited for people to get to learn from the source as it were.
2:55
There's no one better to learn workflows from and ask questions about. We're focusing maybe a bit more on the getting
3:02
started side today in terms of our examples and things like that. But if you have more uh questions relating to
3:08
implementation or maybe some advanced questions, don't hold back. I'm sure we can answer you as well. My name is Alex.
3:14
I'm your host today. I focus on developer experience at Master. So that's a broad umbrella, which means if
3:20
I can make your life a bit easier with the product, maybe that's through SDK improvements, maybe that's through documentation, maybe it's through
3:27
education, right? such as workshops like these. I also contribute to the master YouTube channel where I make videos
3:33
about concepts and tutorials relating to building AI agents in Typescript. So, you can check that out if you want. By
3:41
the way, uh this got uh this little note got cut off, but to reassure you and set
3:46
you at ease, we will definitely be sharing all the code you see today in a GitHub repository. This session is also
3:53
being recorded should you need to drop off or you want to watch it back later. If you sign up via Luma, you'll get an
3:58
email at the end of the session that will include a link to the YouTube video and in that YouTube video's description
4:04
will be a link to the code. I'll also paste a link to the code in the chat as we progress here. So before we jump into
4:11
the code, I'm going to quickly give you a definition of workflows. That way we're starting from the same place. I'm
4:16
going to give a fairly highle overview and what I'm really excited about is seeing these kind of abstract examples
4:23
in the form of a whiteboard come to life in code. You'll see more what I mean about that as the workshop progresses.
4:30
So what is a workflow? An AI workflow is a system whereby large language models are orchestrated through predefined
4:37
paths to complete well-defined tasks. the number of steps and the stopping conditions are fixed and fully
4:43
controlled by you generally resulting in more predictable and consistent behavior. So we have large language
4:50
models though these incredibly this incredibly powerful technology and they are non-deterministic which means you
4:56
can give it the same input 10 times and you'll get 10 different outputs whether that's a simple prompt or you're running
5:02
some kind of autonomous agent. That is very very powerful when it comes to open-ended tasks because an agent can
5:08
find its own way to the outcome. For example, a coding agent takes a very general task to do with a brand new
5:14
codebase and some new requirements and it will figure out the best way to get there, but it might take some wrong
5:19
turns along the way. Right? If you've ever used something like cursor, you'll know that sometimes it goes off the rails a little bit and misunderstands
5:26
you or maybe it's overzealous and makes too heavy changes and sometimes it just gets stuck in a loop and never finishes.
5:33
When we think about using models and leveraging them to build AI powered applications, sometimes agents are a bit
5:39
too non-deterministic. We want a bit more control about the path that the
5:44
workflow takes to achieve this outcome, but we still want to harness that power of a large language model. And so here
5:51
are a few examples to give you an idea. I think the best way to understand this is with some examples. For example, you
5:57
might be coding a meeting summarizer application. You might input a transcript into your workflow and use a
6:04
large language model to summarize the transcript into decisions, actions, items, owners. And then once you produce
6:10
the transcript, you move on to the second step, which is to email the notes to the attendees. The first step here
6:16
could leverage an agent. It could use something like 40 mini to summarize the transcript. But there's no need to use
6:22
an agent to email notes to the attendees. We could run a step in our workflow that uses an API like send grid
6:28
or resend to do that. And so we're kind of harnessing the power of a large language model for this step, but we're
6:34
running deterministic procedural code for the next one. We're mixing and matching to get the best of both worlds
6:40
and we're getting a fairly predictable output here because this task that we delegate to the agent is very focused
6:46
and so it's less likely to go off the rails. We are in control. We determine when the workflow ends, which is once
6:52
these two steps have completed. Another example of a workflow might be to categorize support queries. So, I think
6:59
when we use when we think about agents, we often think about AI assistants. And a really popular well-known example of
7:05
an AI assistant is a chat supports AI assistant. If you have a problem with your Amazon order or maybe you have a
7:12
support inquiry for some B2B SAS you're using, you you might go back and forth with an agent, but these agents are very
7:18
difficult to implement. And a lot of businesses actually are reluctant to put these agents into production because if
7:24
they go off track even just a little bit that could be really dangerous for their business because it might take some
7:29
action that shouldn't provide some wrong information that's very difficult to adopt in external facing agents. And so
7:36
oftentimes when we think about harnessing the power of LLMs, a company or a service provider thinking about how
7:42
to offer better support to their users, they might use a workflow instead where they get some of the benefits of an LLM,
7:48
but all of the power of being able to predefine the path to complete the task. And so maybe a support query comes in
7:55
via an email and the workflow uses a fast efficient model like Mini to
8:00
quickly categorize the incoming support query. If it's something very simple that can be answered from a knowledge
8:06
base, then maybe the workflow moves on to this step where it uses an agent,
8:12
maybe a different agent or a different model, sorry, like GPT5, which is a bit more sophisticated, has better reasoning
8:18
capabilities to generate a response from the knowledge base and send it. If however the support query is a bit more
8:25
nuanced, maybe it's to do with private data like billing or something, this will all be determined by the agent system prompt, you might start a support
8:32
email thread and put it put this user in touch with a support agent instead. We're using an agent. We're using a
8:38
model to categorize and we're using an agent and a model to generate the response in the case that it's a simple
8:44
query, but we also have this option to run deterministic code to start a support email thread. And as you can
8:50
see, we define the whole workflow up front. There's sort of predefined paths that you can take. This stops compared
8:57
to an agent which can take any number of routes. With a workflow, it takes one of these paths. And using workflows in
9:03
master, as you'll come to learn in this workshop, you can do branching to do different things based on different conditions. Another slightly more
9:10
complex example, one I'll just run through very quickly because I love this example, is that of an AI code review
9:16
tool. If your team is using something like GP dial or one of those other pull request code review tools, we don't know
9:23
how they're implemented, but they could conceivably be an AI workflow where they pull they fetch the pull request with
9:28
all of the changes and comments and things like that. They categorize the files, find relevant files, maybe we're
9:35
only checking source code files as opposed to config files and things like that. And then it might run a series of
9:40
steps in parallel. The lincing step might just run deterministic code, running some local process. But maybe
9:46
these two steps to do with checking the style guide um or checking the security
9:51
issues, these might happen using an agent. And when they all finish running in parallel, eventually the workflow
9:57
will do some comment using a GitHub API. And so I think this illustrates how we combine the power of the agent with non
10:04
the non-determinism of code to implement successful AI powered applications.
10:11
Something that comes up a lot and it's a very valid question is about the difference between agents and workflows
10:17
because they have similarities and it might not always be obvious when to use which honestly and that's a very
10:23
fundamental question when you're building an agent because it will inform the approach you take to implementation.
10:29
I previously made a video comparing these two. And the reason I wanted to pull it up quickly, apart from just to let you know this exists if you want to
10:35
go deeper, is because I made this table sort of comparing how they differ and where they each thrive. And so, like we
10:42
touched on, workflows are better suited to well- definfined goals. They follow static paths. They have a fixed number
10:49
of steps as defined in your workflow. And this is the key point here about autonomy. Sometimes when people describe
10:56
AI workflows, you'll hear them described as agentic workflows. And the idea here is that agency is not a binary thing.
11:02
It's not that something has agency or it doesn't. It's more of a spectrum. And we can probably agree that if you're just writing TypeScript, that's pretty low
11:09
agency because you predefine every step. There's no thinking happening. But when you get into the territory of workflows
11:15
like that first example I showed you with a meeting summarizer, this is somewhat agentic in that it can reason
11:21
in that it can take decisions and do things without us being explicit about the instructions, but it's not as
11:26
agentic as say a coding agent or a deep research agent or something like a computer agent. That's where things get
11:32
to be more high agency. You can implement workflows that pull together different agents with different scopes
11:39
of responsibility and you get closer to this sort of uh end of the spectrum to
11:44
do with high agency. But it's ultimately a spectrum and what we're describing here when we talk about workflows is
11:50
somewhat of a architecture or an approach to structuring your agents. It's really going to be up to you to
11:55
determine what you're trying to build and the right way to structure it. And to help you do that, we offer Mastra,
12:02
which is the TypeScript agent framework. Specifically today, we're going to be talking about workflows. This is where
12:08
you get to bring those diagrams I was showing you to life with real code, with
12:14
real models. And to teach you a bit more and show you how it comes together, I'm joined by Tony. So Tony, how about we
12:22
jump into some of the code? And in the meantime, I'll keep an eye out for any questions people have so I can jump in
12:28
and make sure we deliver as much value as we can in the next half an hour or so here. Sounds great. Let me just shut up set up
12:34
my screen share here. So hopefully you should all see my editor right now.
12:40
How's the font, Alex? Is it looking good or should I zoom in a bit more? It looks nice. Um yeah, I love it. Go
12:47
full screen if you can, but no worries if you're I'll be switching windows quite a bit. Yeah, switching windows. Exactly. later
12:52
here. All right. So, first we'll look at code just a little bit. So, we're going
12:57
to go through like a series of examples here. I've prepared five different workflow examples for us to demonstrate
13:02
some of the basic building blocks and how to put those together. Um, so at the root of every master project, usually it
13:09
will be under the mustra folder in an index file. Um, if you follow the usual conventions, there will be a muster
13:15
class instance. And this is the home of really all of the master primitives, all the workflows that you want uh to be
13:21
accessible and callable over HTTP or with like the client SDK libraries. Um
13:26
all the agents, there's some storage involved. Um we'll see why that's very useful later on, but this allows us to
13:33
store certain things in different databases. Um and then certain like observability configuration so you can
13:40
really understand what's going on. Now, before we actually dive into any workflow code, and we're actually not
13:46
going to spend as much time in code today, um, as you might expect, we'll
13:51
run a master dev here in the project, and that will boot boot up the master studio for us.
13:58
And I'm just going to open this link here. I actually have it open already.
14:03
I'll go into the workflows tab here, and you see all of these workflow examples that I had open in the editor just now.
14:11
So everything that you register in the master instance whether it's your agents or your workflows um those will all be
14:16
here for you to play with and see what they are. And this is our first example for today. It's quite simple starting
14:23
point. We have a workflow with two steps that run in sequence. One that fetches the weather forecast for any given city
14:29
that you pass to it and then one that plans activities based on what the weather conditions are for that
14:34
location. You also see there's a form here on the right hand side uh which is asking you to fill in the city to get
14:41
the weather for. So let's go ahead and do that. We'll do that for let's say Helsinki.
14:46
So you see where we fetched the weather that step has succeeded and we are currently planning some
14:52
activities and that has succeeded now as well. There's another tab here on the
14:58
left called observability. So let's see what that's about. So you see that this workflow has indeed been run one time.
15:05
has completed successfully and two steps are a part of this workflow run.
15:11
Firstly, the fetch weather step which took in something like this. It's an object with the city filled in as a
15:17
property and it outputs an object with some weather conditions uh temperature,
15:23
whether it's going to rain, uh that sort of thing. And then the second step being the plan activity step which takes in
15:30
that weather information and it produces this kind of activity plan here. Um
15:36
there's a 100% chance of rain. So better bring an umbrella if you are where I am at right now. Um and you can also see
15:44
some interesting information about any agent calls and like specific element calls that might be happening inside of
15:50
this step here. So in this case there's GPT40 call. You can see all the token usage related to those as well as the
15:56
overall token usage of the workflow itself.
16:02
So let's see what this looks like in code, shall we?
16:07
And open up the editor here again. This is our first example.
16:13
So every workflow starts with a call to this create workflow utility and this is
16:18
what you can import from master record workflows along with create step which we will see soon enough.
16:24
And the ingredients to creating a workflow are you need to give it some sort of a name or like an identifier of
16:30
sorts. It has an input schema and an output schema. Now these dictate what is the values that you plug in and it's a
16:37
structured input sort of a value that you plug into the workflow and what is the actual final results like. So in
16:44
this case we plug in an object with the property city and this looks very familiar from what we just saw in that
16:50
observability tab in the studio. and it produces this activities object which we
16:55
also just just now saw in the studio. So if we take a quick look here again,
17:01
this is what the input to our workflow looks like. And again, the output of
17:06
this is that same object structure that we just saw in the code.
17:12
Now, how does this map to this little form that we had here? Well, this exact label here, the city to get the weather
17:18
for is in fact the description of this property here in the object. So, if we were to add more properties with more
17:24
descriptions, then that form would have more um fields for you to fill out to run that workflow.
17:30
Now, those two steps that we saw in the studio, the fetch weather and plan activity step that run in sequence,
17:36
those are found here. So when you create a workflow you can add steps sequentially by saying then so the first
17:42
step is a sequential single step in the workflow which fetches the weather and only after that step has finished do we
17:49
then plan the activities for that that particular city and weather conditions. You then at the end of it have to commit
17:55
the workflow and that will ensure that you will not add any further steps into it. So we can build whatever the internal representation of that workflow
18:03
is going to be. Then we'll look at the code for the first step here. Similarly to creating a
18:10
workflow, you create a step using utility function and you have an ID, input schema and output schema. Now all
18:16
the master primitives have optional descriptions as well and these are what show up here under these um step ids
18:24
here in the studio. So interestingly you see that the input
18:29
schema has the same shape as the input schema of the workflow. And the reason for this is the first step in a workflow
18:36
takes whatever input the workflow receives as its input. It then produces
18:41
a forecast schema as its output. That schema you can see here. So this is that
18:46
exact object structure that we saw in the observability tab which has a temperature and weather condition
18:52
information in it. And then most interestingly there's an execute function that you attach to a
18:57
step. And this is what actually dictates what happens when you run the workflow. Um and when you run this particular
19:04
step, so in this case we only have one argument here to the execute function which is the input data and you see that
19:11
this basically corresponds to whatever is the shape of what that step takes in.
19:17
Now the code of this step is actually not the most important thing. What we basically do here is just use this open
19:22
media weather API and we plug in the city from the input data and we get a a bunch of information back and then we
19:28
distill that to this forecast format that we had and then we return that at the end of the step.
19:35
Now, interestingly, if I were to let's say comment out this one field of max temperature,
19:43
we see that there's an error here on the create step call. And the reason for this is max maximum temperature is
19:50
actually missing from what you say that this step is going to return. And this is what one of the reasons why
19:55
specifying the correct schema is very important um because you need to be able to like put all these pieces together
20:01
and be sure that you have all the information you need. So being able to make type safe steps into your
20:07
workflows. Let's put that back. Now the error is gone. So we should be good to add the
20:12
step into our workflow. So this is what we return and the next step was a plan activity step. So then
20:19
logically the input schema of this next step is going to be the same forecast schema shape as the previous step
20:25
returns. So the data always flows from the previous step to the next one or again if it's the first step then it
20:31
flows from the workflow inputs to that first step. And since this is the last step in the
20:37
workflow the output schema of this step also matches the final output schema of that workflow itself.
20:44
Now the execute function here is a little bit more involved. It has that same input schema uh variable and it has
20:51
now a different shape the shape of the forecast schema instead. And then there's a master parameter. Now what's
20:58
the master parameter? Well, at the very beginning we saw this master class instance here and every workflow step
21:05
has a reference to this variable. So you can access all the other primitives and features that come along with MRA. So in
21:12
this case what we do is we get an agent from the master instance.
21:17
Um we prepare a prompt for that agent. In this case we plug in the forecast
21:22
information and we plug in the city and then we stream via agent.stream
21:30
the entire text chunk stream of that agent call. We put that in standard out
21:35
but we also accumulate it and return it in the shape that we want to return from that workflow. Now, where's the city
21:42
come from? Because actually in the forecast schema, there's no city in it. Well, there's a third parameter here called get init data. This is a like a
21:50
convenient tool for you to access whatever is that very first input to the workflow in any step because it's very
21:57
common for you to have some additional configurations that you might not even use in that first step, but you want to
22:03
use them later on. Or maybe there's multiple steps here like in this case where the city is needed. you don't need
22:08
to propagate the city all the way through the different steps in the workflow. So, putting that together as a prompt,
22:16
if we run that example again, let's say for Austin
22:23
now that we're planning the activities here, you see actually the process studio.
22:30
Writing that plan for us. That's pretty much all there is to it to
22:36
to the simple use case. Nice. So, what's the advant if we just stay on
22:42
step one for a second? Um, what is the advantage of using master's create step
22:49
function here and create workflow function as opposed to having just a
22:54
code file that does one thing after another without a framework?
22:59
Uh, a lot of advantages I would say. Um, one of them is all the steps can be
23:05
retrieded automatically. So if there's anything that goes wrong, let's say in this agentic step here. Um, like maybe
23:12
there's an API issue with whatever like whatever LM provider you're using, the
23:18
step will be automatically retrieded based on some retry configurations that you can set in those steps. Um, you will
23:25
see later on different benefits from using different tools for human in the loop interactions. So you can suspend
23:30
the execution of your workflow and then resume it later on. Um you can also
23:36
let's say something happens to your server, you can resume the execution of your workflow when you know the server comes back up potentially.
23:43
Um you can also do things in parallel quite easily which you will see later on. Um
23:51
yeah I think there's loads of benefits. One of them is the type safety of doing things like kind of block by block and
23:57
another of course is uh being able to see everything that's happening and being able to plug things together.
24:03
Oh, I like that point about being able to see things because right now we're looking at a CLI output and we're
24:09
looking at Master Studio which is an interactive development environment. Um Tiny talk has a question. They ask
24:17
how do you connect that to your front end and can you send custom update chunks back to the client while the
24:23
execution is still in progress? You can completely completely customize
24:28
everything that's sent from any of the steps. So there's actually like a another parameter you could add here called the writer and using this writer.
24:36
Um well that's kind of a weird update to do. I think you can even do something more structured here. um let's say
24:49
something like that. And as long as you write this uh this will show up in your stream as
24:54
well. It will it will show up as a workflow step output event in your workflow stream if you're streaming the
25:00
output of your workflow. Um so you can do any any sort of custom updates of any kind uh through this mechanism.
25:08
Um, and then yeah, as far as how you integrate this into a UI framework, I would say the easiest way, um, that's
25:15
not really part of the workshop, but let's see if we can whoop something up here quickly. So, there's two ways to
25:21
run a workflow programmatically. One is using start, and this promise only resolves once the whole workflow has
25:26
completed. Um but you could also do stream in which case you will back get
25:31
back something where
25:37
you can actually like do a fourway const chunk of this and then this is where
25:44
those events will show up. Now if you're using this with let's say the client SDK um all of these events are something
25:51
that you can render um with whatever UI framework you use. There's also different like AISDK transformer tools
25:57
that we have. I don't know if we really have time to get into those, but maybe we can send some documentation to those
26:03
afterwards. That's a great idea. Raphael asked, "What if they have four steps and they
26:10
want the output of step two in step four? Do they need to propagate that data through step three or is there a
26:16
way to get step two output in step four?" That's interesting because you can get step one input anywhere, but
26:23
what if you want to get the output of a previous step in a later step? Uh there is a way. Uh we'll actually see
26:29
that in the next example, I believe. Um so maybe we can cover cover it in a few minutes. Oh, perfect segue. Yeah, let's do it.
26:35
All right. So let's look at the next one here. It's based on the same principle
26:40
and the same code in some way, but slightly more involved here. So can I draw one parallel, Tony? When I
26:47
drew those diagrams in TLR, I was trying to resemble the master studio interface.
26:53
So, if you think back to those abstract workflows, now you're seeing, although it's a different example, I think you
26:58
see it coming to life, which is really cool. Well, there we go. So, a very similar
27:06
example here. We start by fetching the weather. We give it a city, but then we see this little branching happen to
27:13
these two when blocks. And you see that there's a condition attached here. So if the chance of rain is more than 50%, we
27:20
end up in this branch here. And if it's at most 50%, then we end up in this branch. Now this plan activity step is
27:27
the same as before. So if I was to run this with Helsinki and we saw the chance of rain was very high, it's going to end
27:33
up in this new branch where we plan indoor activities instead of outdoor ones. So again, if I go to the
27:39
observability tab here, we see there's a fetch weather step
27:45
which looks exactly the same as before. However, now we have this plan indoor activities thing which only gives you
27:52
indoor activities um independent of like as long as the chance of rain is more
27:58
than 50% or like at least 50% then it's only going to give you indoor activities in this case. Normally it would give you
28:04
at least some outdoor activities as well. And again here you see the LM call information. And then now here actually
28:11
you have this mapping step. So if we go back to this there's this weird little box
28:17
here which I haven't named. So it has like an automatically generated name but it is a mapping of sorts. Now if we look
28:24
at at what that does here in observability, you see that it takes as input this object that has a key plan
28:31
indoor activities and then it has this activities objects as its value and it produces an object with just activities.
28:39
Now it's going to make more sense if we look at the code. So let's just do that. So this is the weather workflow for this
28:46
example. The same setup here in terms of what the workflow should take in and produce starts with the same first
28:52
sequential step but then instead of a then to plan activities there's a branch
28:59
and a branch takes an array of these tupils where the first value is a condition. Now this is that exact same
29:04
condition that you saw in the studio before. And if the chance of rain is high then we run this plan indoor
29:11
activity step otherwise we plan the usual you know multi-activity plan. Now
29:18
branch since actually these conditions don't need to be mutually exclusive. It could be that both of these are run at
29:25
the same time in which case they do actually run in parallel. Or it could be that only one or even none of these get
29:32
run. So what branch returns as its output schema is in fact not just that
29:38
object with the field activities in it, but it looks something like this. It's like a record um where every key is
29:47
like the ID of all the steps that are part of the branch and then their values
29:52
are those steps uh respective output schemas. In this case they do happen to be the same schema but they need not be
29:58
the same schema actually. So here because our workflow needs to produce just this object not this one.
30:06
All we do is we map the result to be
30:12
this like activities object and where does the value for that come from? It comes from the activities value of
30:18
either this or this step. Now there's other ways to map this. You could also do a function that resembles
30:25
um an actual like step execute function. So you could
30:31
do like an input schema here or input data sorry here and then here you could actually access those individual uh step
30:38
schema. So there's like a function called get step results that you can use. This is like a transformation basically
30:45
if you want to transform the output of the previous step into a new shape for the next step. Map is the right tool to
30:52
map and filter basically. Indeed. So what we could do here is we could take the result of the plan
30:57
activity step and the plan indoor activity step and then we could manually check whichever of those is defined or
31:04
we could return both of them or whatever we wanted to do. And now map doesn't need to be the last thing in the work in
31:11
the workflow but here you could do uh you know you could even return the um output of that very first step weather.
31:20
There's a good question here from George who asks, "When building AI chat bots, would you go with an agent or with a
31:26
workflow and branch based on different paths?" Um, that depends very much on your use
31:33
case. So, if you start with a workflow that branches, you introduce a lot of determinism. So, if that is what you
31:39
want to do, then that may be the right choice for you. What it also means is that the inputs that you plug in to that
31:46
workflow, they're always structured, right? you plug in some kind of object or I mean you could plug in a string and
31:51
then have an agent as the first step. But perhaps if that's what you're going to have to do, it might be better to
31:57
have the agent be the entry point and then that agent may call the workflow in fact or it may do something else. And we
32:04
will see that example later on as well. Yes, that was that's a that was a good question from earlier but I've missed
32:10
which was about um asking if you can combine workflows and it's really
32:16
interesting, isn't it? Because you can nest workflows, you can even wrap up a workflow in a tool so your agent can
32:21
call it. All of these primitives can interact. Indeed. And that's going to be the next
32:27
example in fact is how to combine workflows. Awesome. We're at um 10 past uh the
32:34
hour, Tony. Um so I think we should run for another 10 minutes or so. How does that sound?
32:40
Sounds good. So just one more thing before we move on to the next example. So this map construct is not just
32:46
something that you can call at the end of the workflow. You can in fact call it anywhere you want to call it. It can sit
32:52
between any steps. So if you wanted to modify whatever output, let's say the fetch weather step produces, you could
32:57
have a map here and then the result of this map is what actually gets plugged into these steps here in the branch
33:04
instead of this output. So you can really use it to transform one output to
33:10
another kind of an input or you can also use to transform that final result of the workflow. Uh it's really up to you
33:16
where you need that where you need to use that. Like if you have let's say two different kind of workflows that share
33:21
some of the same steps but they don't fit exactly together in both those cases. Maybe in one it does but in the
33:27
other it doesn't. You can always use map to kind of glue things together nicely.
33:33
Rupage asked if we can integrate master workflows in a versatile AI project where they're currently using the stream
33:39
text function of a cell already. Um how in h how can they integrate
33:46
workflows with that project? Uh I think that also depends a little
33:51
bit. So I mean you can plug in um like AISDK models into Mustra. Um that's in
33:57
fact like the main way that you do that. So we'll look at some of those agents used here. Let's see for example the
34:03
planning agent that we are using. Um I think this is specifically talking about the stream format because a AI SDK
34:11
UI doesn't recognize master workflows, right? Y yeah. So there's um like a transformation layer that takes workflow
34:18
events and then it turns them into something like AI SDK compatible where um everything is like a custom UI
34:25
message. Um I think we have some docs for that as well. So maybe we can try and round those up at the the end.
34:32
In what way does map differ from step? Uh map is really just more of a
34:38
convenience if you want to map one thing to another thing. Uh it's less it's a little bit less uh verbose than a step
34:43
is. Um if you use map with a function, it's also not exactly as type safe as a
34:49
step because with a step you specify exactly what input and output you expect. But then map as a function does
34:55
not. If you use that object syntax that we have here, uh, then this is type safe because we know what the schemas of
35:01
these things are, but it limits you just to mapping whatever comes from these steps and this path. So, it's a little
35:07
bit more limited than using that function. I would advise if you do anything except something super simple
35:12
to always use step and if you use a map then to try and prefer this syntax as it is more type
35:18
safe. Beautiful. Should we move on to the next example?
35:24
Yes. So this is basically the exact same example that we just looked at except instead of planning planning indoor
35:30
activities if the chance of rain is higher the conditions here are a little bit different. It's based on 20% instead
35:35
of 50. But this step here is in fact a workflow itself. So there's three steps
35:41
here. And interestingly you see like these two dangling entry points. There's not just one step but two and then they
35:48
kind of come together and the synthesiz step here. So let's see what this does. Again, if it rains, we're going to end
35:54
up here. So, I'll just click on Helsinki because as you can see, it's raining. Um,
36:00
so you see here that the plan both workflow is a step, but it also has these
36:06
substeps that are running. And this step only completes after all these three steps have run.
36:13
Now that we synthesize all the information, we go again to that same mapping step here. And looking at observability for this
36:22
uh we have the same fetch weather stuff. We evaluate conditions um and then based on the condition we
36:28
pick to run this plan both workflow step but that actually runs a workflow run itself and it runs a parallel of two
36:36
branches plan indoor and plan indoor activities and plan activities simultaneously and then it runs the
36:42
synthesize step and this value that it takes as inputs looks quite familiar I'm
36:47
sure because this is exactly the same schema format that branch had except now
36:53
both of those activity plans are here and then it produce some produces some kind of a combined report of those.
37:00
Let's look at the code for that here. So again exact same with our workflow
37:05
except here we have a plan both workflow instead of a step and this is actually just the workflow itself. There's no
37:11
create step here because the workflow and the step have the same interface. They both have input and output schemas
37:18
and it doesn't have an execute function but what I call like the flow description of the workflow. Uh this
37:24
basically tells you what that execute function is right what you need to do to execute that workflow as a step. It
37:31
needs to run all these steps. So why we had those two dangling boxes those two entry points uh is because we don't
37:38
start the we start the parallel. Now that parallel takes an array but in this
37:44
case as many steps as you want it to run in parallel. Here we have the plan activities and plan indoor activities
37:49
steps running concurrently and we then only after both of those steps have completed end up in this synthesiz step
37:56
which as its input schema takes that record format with both those step ids in it their respective output schemas.
38:04
We then using this master instance take the synthesize agent use agent.stream.
38:11
But the prompt is now a combination of both of those input values from those
38:16
two steps that run. And we ask it to kind of put together an overall plan based on these two different
38:21
alternatives. And again the same deal. We go through all the text chunks from that LM stream
38:28
and then output those and then accumulate those so we can return that at the end of the workflow. and then map
38:34
those into the shape that we wanted to return. And this is how you can combine workflows.
38:41
Another example, just kind of speed up a little bit here. Sorry, Tony. I'm going to use this opportunity to ask a couple of
38:47
questions. Um, there was a question about if it's a good idea to have a big object to pass
38:54
data from step to step and add new data to each step so it can be used in all steps. I think they're basically
39:00
describing like aggregating an object or should you only have the necessary input and output schema and keep it as
39:06
lean as possible? I think in general you should try and keep it as lean as possible. If you have
39:12
scenarios where all the steps need something that's shared if it's not a part of that initial input of workflows.
39:19
Uh we do actually have a new feature for workflows called uh workflow run state which lets you have something that's
39:25
like more global to the execution of the whole run itself. Um there's actually some docs shipping for that this week.
39:31
Uh it is already live, so stay tuned for that one. But otherwise, you do always have that tool at your disposal that we
39:37
briefly saw earlier um which was to use this um oops this little get
39:46
step result mechanism here which lets you basically plug in any step and this will return
39:53
what was the output of that step. Uh okay. So that's how you'd get step two result in step four. For example, like
39:58
someone it's like more occasional that you want something from one of the steps that passed then I would use this. Um so you
40:07
pass the context along all the time. Christian asked if we can dynamically build the list of steps to be launched
40:13
in parallel. That's a great question. I think you can. Yeah. So I mean here all the
40:18
workflows are built kind of statically but what you could also do is you could have let's say uh I don't know you make
40:25
an API call to some whatever API just something random that doesn't really exist but point being here you know you
40:33
could actually call like I don't know let's say it's a an array of things then you can map over that and then for all
40:40
those things you could actually call create workflow. Oh, nice. Or or it could be like a create step and
40:47
then this is what you actually like plug into your workflow as steps, right? I love that. Um or like you can really build anything
40:53
you wanted as long as you commit at the end of it, it does become runnable. And we actually use that internally in
40:58
master quite a bit as we construct workflows fully dynamically and then we run them.
41:04
So, I'm not sure if this is already the next um code example, but with only a
41:10
few minutes left, I would love to see a human in the loop example and maybe you can touch on
41:15
you teased Tony, you teased us. You said at the at the start you pointed out storage and you said you'd come back to
41:21
storage and I'm really interested to learn more. This is part of the part where or this
41:26
is part of where we come back to it. The other part is I'll just mention it right now is all this observability stuff that
41:31
we see here. Uh this is all based on storage as well. I keep restarting the server. That's why it goes away. But if
41:36
we were to run this example again, um then all of this stuff of like you know
41:43
what we're looking at of how the runs actually progressed, what was the input and output values at each point, this is
41:49
all saved in the storage as well. So this is why you're able to see all the information after the fact. Another
41:54
reason uh many why it's very useful is going to our next example here. This may
42:00
look like a downgrade in terms of complexity, but just wait for it. It's not. Um, similar structure. We have one
42:07
um parameter here. Uh, we need to give it some kind of description of a vacation. Let's say that I want to go to
42:13
the beach, which I rarely do, but there it is. It's going to generate some suggestions. There's some kind of human
42:20
input here in between, and then we do a travel planning at the end of it. So, let's run this.
42:26
So, we have some suggestions. Wow, that's new. Uh you can actually see three suggestions here and you can see
42:32
that the workflow is now suspended and there's like this little pause icon here and this human input step and we ask for
42:38
a selection and then to resume the workflow. So let's pick Bali I guess click on resume. Ah so now the human
42:45
input step has finished. This stays the same as it was before and we're now doing some sort of travel planning. So
42:52
if we look at the observability for this one interestingly you see there's two entries here. So let's look at the first
42:58
one. We'll run this generate suggestions thing that runs a travel agent sort of an LLM thing. Um so again takes
43:06
navigation description generates those suggestions that we saw and then here
43:11
you see that this next step of human input it gets those suggestions doesn't return anything and it has
43:19
suspended status. Mhm. Now looking at the next entry here, we start at the human input step.
43:27
It now does have an output which is the selection that we made. We then run that last step which get
43:33
that gets that selection and creates a travel plan. So looking at the code for this one
43:39
again three sequential steps inputs and outputs look exactly like they do in the observability section. generate
43:45
suggestions is now using um generate on monom master agent
43:51
instead of stream. No other difference except we want it to return like a
43:57
JavaScript object structure instead of text and we want it to be an object with a suggestions array that's like objects
44:05
with locations and descriptions on them. So then we can just return that object directly to the next step. So in the
44:12
next step we can get an array that on the human input step we have an output schema that's the selection that we saw
44:19
but there's two new schemas here we have a resume schema which is you know that
44:25
actual selection that the user makes is what we saw in the form and it has a
44:30
suspend schema which has that shape that we saw appear if we were to quickly run this And
44:42
you see that this shape here matches that suspend schema and then the selection of the user comes
44:48
from that resume schema description here. So what's basically happening is we have a couple new parameters to the
44:54
execute function in in play here. We have the usual input data of course but then we have a resume data which can
44:59
either be undefined. It can be that object with selection string in it which that resume schema shape and we have a
45:07
suspend function which takes in a payload which again is in the suspend schema shape. So what we do in this step
45:14
is we check if we have a selection from the user. So if the resume data is defined and there's selection or sorry
45:21
there is not one then we suspend the execution of the workflow and we pass in the suggestions that were generated in
45:27
the previous step. However, we do have that selection. We just pass it forward to whatever is the next step, which in
45:34
this case is planning the the activities for that trip using again generate call.
45:40
Then taking the original weather description, sorry, the vacation description from the workflow's initial inputs, taking the selection from
45:47
whatever we passed from the human input in input step and then that gives us that final.
45:56
And do suspended workflows consume resources while in a suspended state? They do not. And this is where one of
46:03
the other reasons why storage specifically for workflows is very interesting is when you suspend a
46:08
workflow, the execution actually stops. And this is why in the observability tab here, you see two different entries
46:15
because these are uh essentially two different runs of the same workflow. So when you suspend what happens is at this
46:22
particular point in time we take the whole run state of the workflow the state of all the previous steps all the
46:28
inputs of this particular step and so on uh and we snapshot that into storage.
46:33
So you can come back in 10 seconds or 10 hours or 10 days or 10 years even
46:39
theoretically speaking and then resume the execution of that workflow as it were at the point that you suspended it.
46:44
So it's like a point in time snapshot of the entire workflow execution state.
46:49
Finally, Tony, can you please show us that code example where you run the workflow manually as opposed to because
46:56
there's a good question here about, you know, how do you reference the suspended workflow? And I think that might have the
47:01
that previous that this might be the key where you show how to reference the workflow graph. Yeah, here we go. This is actually a little bit outdated,
47:07
but let's see if we can quickly whip something up here in this example. So it doesn't really exist anymore. this time.
47:14
Let's see step five. And then this one takes in actually let's take one of the earlier ones. First one. And then
47:24
let's simplify into run.st start.
47:32
That
47:39
will type Tony. I'll just answer every pass you asked about if you can when steps from in parallel um
47:46
can can what can we have steps from in parallel where the number of steps will depend on some condition like the number
47:53
of files a user uploads I think the answer is yes because you can construct the workflow using code and so you could
47:58
do that in a loop or whatever right there's also another way which we didn't go over um but there is a construct
48:05
called for each and that for each takes an array ar of
48:11
it basically takes like as its input schema takes as an array of anything and then the step that you plug into for
48:18
each will take the individual items. So it's kind of like a for loop um if you will. So there could be like a you know
48:24
iteration step and this takes one it like one single item but for each as a whole takes an array of that item type
48:32
and then you can adjust the concurrency as well. Oh yeah that's a nice option. So you can
48:38
run 10 simultaneously. Oh my god, I have my own question. How's that different from parallel?
48:45
It's different from parallel in the sense that for each depends on the in
48:50
from the inputs of for each. So whatever you return from the previous steps that will be an array of however many items
48:56
in it and then that is the base of your parallelism. Whereas parallel you give like just a number of different steps to
49:04
run, right? So for each runs the same step but over a variable kind of size of
49:09
argument or variable sized array of arguments but then parallel is different steps rather than the same step multiple
49:15
times. Nice. And the inputs are the same for parallel. Thank you Tony.
49:20
So should we just close back to this example just to show the um so how you would then do like if you
49:28
wanted to resume it it would basically be like this. So you start a workflow, you pass in the input data, which is
49:34
that familiar shape of passing a city and then as soon as it's done, we can
49:40
print out the results. If the state is that it's suspended, then what you can do is on that same run object, you can
49:46
call resume and then pass in the resume data that you wanted to. In this case there there is no suspend in the
49:52
workflow, but to illustrate the point, you can pass in whatever resume data you wanted. You can also pass in optionally
49:58
a resume step um because the workflow can also be suspended multiple steps at the same time. And if that's the case,
50:04
then you need to tell the resume command which step you want to resume specifically. If only one state is
50:10
suspended at a time, you can just resume without that argument. Um and now if you don't have this run object like on hand,
50:18
you can always create it again actually. So what you could do is like uh you can
50:24
pass in a run ID and as long as this comes from like this
50:30
run ID comes from some external system or something you generate and store
50:35
somewhere uh then you know using the same run ID you're always going to be resuming that same specific run instance
50:42
of that workflow. So that's kind of in a nutshell how the
50:47
resuming would work programmatically. Beautiful. Thank you so much Tony and
50:52
thank you so much everybody for tuning in. There's a few more good questions in the chat I would love to get to but we
50:57
are already over time. Uh I think yes really appreciate your time Tony and thank you again everyone for tuning in.
51:04
I'm sharing a link to the code and the recording in the Zoom chat. So maybe you joined late and you want to watch from
51:09
the beginning or you just want to reference some of these code examples so you can go more in depth. This will be a
51:15
great resource. You can also check out the master YouTube channel where I've created a couple of videos on workflows.
51:20
I have a video on parallel and a couple on human in the loop. If you like learning from video, that might be up
51:26
your streets. And for all your other questions, hit us up on X. You can DM me or you can post at Mastra. You can also
51:33
join the Master Discord channel. Sorry, I don't have a link handy, but you can find it referenced on the website. And
51:39
that's probably your best way to get a nice tidy support thread and we can help you with any of your questions. And not
51:44
only that, I mean, when you ask a question, it can sometimes feel a bit like you're the one benefiting, but we
51:50
truly benefit from your questions because when we see where the questions are and the gaps are, well, that's an
51:55
opportunity for us to make the answer more clear either with docs or guides or SDK updates and things. So, we welcome
52:02
your questions. I hope to see you in Discord and I hope to see you at a future master liveream. We host these
52:08
every Thursday around this time, give or take half an hour, and we dive into different topics conceptually. So, maybe
52:15
I'll see you there. And one more time, Tony. Thank you so much. It's been such a pleasure. Thank you. And if I may take 10 more
52:21
seconds, there's a fifth example which you might want to look at. This is how to like loop based on a condition. And
52:27
also, I just wanted to show you real quick how you could create an agent that has a workflow as a tool. It's Tony.
52:33
I'll listen to you for another 10 minutes, mate. So, take it, please. It's truly that simple. If you want to have a
52:39
workflow as a tool, we automatically wrap them. If you just plug it as a as an argument or as a parameter into a
52:46
workflow like this to an agent, sorry, like this, you can plug in as many workflow as you wanted based on the
52:51
description, the schemas, and everything of the workflow. The agent will just figure out how to use it and what it's for. And that's that's it. That's my
52:58
that's my last thing. There's a link to Discord and I think that's our Discord. Janel generously
53:05
shared the link. Thanks again everyone.


```
