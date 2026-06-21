using MediatR;

namespace Demo.Application.Accounts.Handlers;

public class CreateAccountCommandHandler
{
    private readonly IMediator _mediator;

    public async Task Handle(CreateAccountCommand request, CancellationToken cancellationToken)
    {
        await _mediator.Send(new NotifyAccountCommand(request.Name), cancellationToken);
    }
}
